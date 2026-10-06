<?php
/**
 * agenda-import.php — impor satu kali dari assets/data/agenda.json ke database.
 * Hanya bisa dijalankan lewat terminal (CLI), bukan browser.
 *
 *   php agenda-import.php                      (impor; menolak kalau tabel agenda sudah berisi)
 *   php agenda-import.php --force              (hapus sesi + pembicara lama, impor ulang)
 *   php agenda-import.php --keep-dates         (pakai tanggal dari agenda.json; default: 19/20/21 November 2026)
 *   php agenda-import.php path/ke/agenda.json  (lokasi JSON lain)
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only.');
}

require __DIR__ . '/config.php';

$force = in_array('--force', $argv, true);
$keepDates = in_array('--keep-dates', $argv, true);
$file = null;
foreach (array_slice($argv, 1) as $a) {
    if (strpos($a, '--') !== 0) {
        $file = $a;
    }
}
if (!$file) {
    $root = is_dir(__DIR__ . '/assets') ? __DIR__ : dirname(__DIR__);
    $file = $root . '/assets/data/agenda.json';
}
if (!is_file($file)) {
    exit("File tidak ditemukan: $file\n");
}
$data = json_decode(file_get_contents($file), true);
if (!is_array($data) || empty($data['days'])) {
    exit("agenda.json tidak valid.\n");
}

$pdo = db();
$has = (int) $pdo->query("SELECT COUNT(*) FROM agenda_sessions")->fetchColumn()
    + (int) $pdo->query("SELECT COUNT(*) FROM agenda_speakers")->fetchColumn();
if ($has && !$force) {
    exit("Tabel agenda sudah berisi data. Jalankan dengan --force untuk menimpa.\n");
}

function norm_time(string $t): string
{
    [$h, $m] = explode(':', str_replace('.', ':', trim($t)));
    return str_pad($h, 2, '0', STR_PAD_LEFT) . ':' . $m;
}

function parse_time_label(string $label): array
{
    if (preg_match('/(\d{1,2}[:.]\d{2})\s*[—–-]\s*(\d{1,2}[:.]\d{2})/u', $label, $m)) {
        return [norm_time($m[1]), norm_time($m[2])];
    }
    if (preg_match('/^\s*(\d{1,2}[:.]\d{2})\s*$/', $label, $m)) {
        return [norm_time($m[1]), null];
    }
    return [null, null];
}

function speaker_num(string $sid): ?int
{
    return preg_match('/(\d+)$/', $sid, $m) ? (int) $m[1] : null;
}

$dateMap = [1 => '19 November 2026', 2 => '20 November 2026', 3 => '21 November 2026'];

$pdo->beginTransaction();
try {
    if ($force) {
        $pdo->exec("DELETE FROM agenda_sessions");
        $pdo->exec("DELETE FROM agenda_speakers");
    }

    // Pembicara — id numerik mengikuti angka di "speaker-0NN"
    $insSp = $pdo->prepare("INSERT INTO agenda_speakers (id, name, position, institution, photo_path, bio) VALUES (?, ?, ?, ?, ?, ?)");
    $known = [];
    foreach ($data['speakers'] ?? [] as $i => $s) {
        $n = speaker_num((string) ($s['id'] ?? '')) ?? ($i + 1);
        $insSp->execute([$n, $s['name'] ?? '', $s['position'] ?? '', $s['institution'] ?? '', ($s['photo'] ?? '') ?: null, $s['bio'] ?? '']);
        $known[$n] = true;
    }

    $upDay = $pdo->prepare(
        "INSERT INTO agenda_days (day, label, title, date_label, groups_json) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE label = VALUES(label), title = VALUES(title), date_label = VALUES(date_label), groups_json = VALUES(groups_json)"
    );
    $insSess = $pdo->prepare(
        "INSERT INTO agenda_sessions (day, sort_order, start_time, end_time, type, room, title, description, kind, group_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $insLink = $pdo->prepare("INSERT IGNORE INTO agenda_session_speakers (session_id, speaker_id, sort_order) VALUES (?, ?, ?)");

    $nSess = 0;
    foreach ($data['days'] as $d) {
        $n = (int) preg_replace('/\D/', '', (string) ($d['id'] ?? ''));
        if (!in_array($n, EVENT_DAYS, true)) {
            continue;
        }
        $date = $keepDates ? ($d['date'] ?? '') : $dateMap[$n];
        $groups = !empty($d['groups']) ? json_encode($d['groups'], JSON_UNESCAPED_UNICODE) : null;
        $upDay->execute([$n, $d['label'] ?? "Day $n", $d['title'] ?? '', $date, $groups]);

        foreach ($d['sessions'] ?? [] as $i => $s) {
            [$st, $en] = parse_time_label((string) ($s['time'] ?? ''));
            $insSess->execute([
                $n, $i + 1, $st, $en,
                $s['type'] ?? 'Session', $s['room'] ?? '', $s['title'] ?? '', $s['description'] ?? '',
                ($s['kind'] ?? '') === 'break' ? 'break' : 'session',
                ($s['group'] ?? '') !== '' ? $s['group'] : null,
            ]);
            $sid = (int) $pdo->lastInsertId();
            $nSess++;
            foreach (($s['speakers'] ?? []) as $k => $spk) {
                $num = speaker_num((string) $spk);
                if ($num !== null && isset($known[$num])) {
                    $insLink->execute([$sid, $num, $k]);
                }
            }
        }
    }
    $pdo->commit();
    echo "Selesai: " . count($known) . " pembicara, $nSess sesi diimpor.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    exit("Gagal: " . $e->getMessage() . "\n");
}
