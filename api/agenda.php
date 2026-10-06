<?php
/**
 * agenda.php — endpoint Agenda (di-require oleh index.php).
 *
 * Routes (semua di bawah /api/agenda):
 *   GET  /api/agenda                publik -> { days:[{..., sessions:[]}], speakers:[] }  (bentuk sama dengan agenda.json)
 *   GET  /api/agenda/admin          staff  -> payload yang sama (tanpa cache)
 *   POST /api/agenda/session/save   staff  -> JSON: id?, day, title, type, room, description, kind, group, start, end, speakers[]
 *   POST /api/agenda/session/delete staff  -> JSON: id
 *   POST /api/agenda/session/move   staff  -> JSON: id, dir (-1 naik | 1 turun)
 *   POST /api/agenda/day/save       staff  -> JSON: day, title, date, groups ("Label | Judul" per baris)
 *   POST /api/agenda/speaker/save   staff  -> multipart: id?, name, position, institution, bio, photo?, removePhoto?
 *   POST /api/agenda/speaker/delete staff  -> JSON: id
 */

const AGENDA_UPLOAD_REL = 'uploads/agenda';
const AGENDA_MAX_PHOTO = 3 * 1024 * 1024; // 3 MB
const AGENDA_PHOTO_MIMES = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

function handle_agenda(PDO $pdo, string $method, string $sub, string $sub2): void
{
    $key = $sub === '' ? '' : ($sub2 === '' ? $sub : $sub . '/' . $sub2);

    if ($method === 'GET' && $key === '') {
        agenda_public($pdo);
        return;
    }
    if ($method === 'GET' && $key === 'admin') {
        agenda_admin($pdo);
        return;
    }
    if ($method === 'POST') {
        $routes = [
            'session/save' => 'agenda_session_save',
            'session/delete' => 'agenda_session_delete',
            'session/move' => 'agenda_session_move',
            'day/save' => 'agenda_day_save',
            'speaker/save' => 'agenda_speaker_save',
            'speaker/delete' => 'agenda_speaker_delete',
        ];
        if (isset($routes[$key])) {
            $routes[$key]($pdo);
            return;
        }
    }
    json_error('Not found: ' . $method . ' /agenda/' . $key, 404);
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
function agenda_site_root(): string
{
    return is_dir(__DIR__ . '/assets') ? __DIR__ : dirname(__DIR__);
}

function agenda_upload_dir(): string
{
    $dir = agenda_site_root() . '/' . AGENDA_UPLOAD_REL;
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        json_error('Folder upload tidak bisa dibuat: ' . AGENDA_UPLOAD_REL, 500);
    }
    $ht = $dir . '/.htaccess';
    if (!is_file($ht)) {
        @file_put_contents($ht, "Options -Indexes -ExecCGI\n<FilesMatch \"\\.(php|phtml|php[0-9]?|phar|pl|py|cgi|sh|html?|js)$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n<IfModule mod_php7.c>\n  php_flag engine off\n</IfModule>\n<IfModule mod_php8.c>\n  php_flag engine off\n</IfModule>\n");
    }
    return $dir;
}

/** Hapus file hanya kalau berada di uploads/agenda (foto bawaan di assets/ tidak disentuh). */
function agenda_unlink(?string $rel): void
{
    if (!$rel || !preg_match('#^' . preg_quote(AGENDA_UPLOAD_REL, '#') . '/[A-Za-z0-9._-]+$#', $rel)) {
        return;
    }
    $path = agenda_site_root() . '/' . $rel;
    if (is_file($path)) {
        @unlink($path);
    }
}

function agenda_valid_time($v): ?string
{
    $v = trim((string) $v);
    if ($v === '') {
        return null;
    }
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v)) {
        json_error('Format jam harus HH:MM.', 422);
    }
    return $v;
}

function agenda_time_label(?string $s, ?string $e): string
{
    if ($s && $e) {
        return $s . ' — ' . $e;
    }
    return $s ?: '';
}

function agenda_next_sort(PDO $pdo, int $day): int
{
    $st = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM agenda_sessions WHERE day = ?");
    $st->execute([$day]);
    return (int) $st->fetchColumn();
}

function agenda_payload(PDO $pdo): array
{
    $links = [];
    foreach ($pdo->query("SELECT session_id, speaker_id FROM agenda_session_speakers ORDER BY session_id, sort_order, speaker_id")->fetchAll() as $l) {
        $links[(int) $l['session_id']][] = (string) (int) $l['speaker_id'];
    }

    $byDay = [];
    foreach ($pdo->query("SELECT * FROM agenda_sessions ORDER BY day, sort_order, id")->fetchAll() as $r) {
        $id = (int) $r['id'];
        $byDay[(int) $r['day']][] = [
            'id' => $id,
            'time' => agenda_time_label($r['start_time'], $r['end_time']),
            'start' => $r['start_time'] ?? '',
            'end' => $r['end_time'] ?? '',
            'type' => $r['type'],
            'room' => $r['room'],
            'title' => $r['title'],
            'description' => $r['description'] ?? '',
            'kind' => $r['kind'],
            'group' => $r['group_label'] ?? '',
            'speakers' => $links[$id] ?? [],
        ];
    }

    $days = [];
    foreach ($pdo->query("SELECT * FROM agenda_days ORDER BY day ASC")->fetchAll() as $d) {
        $n = (int) $d['day'];
        $o = [
            'id' => 'day-' . $n,
            'day' => $n,
            'label' => $d['label'],
            'title' => $d['title'],
            'date' => $d['date_label'],
            'sessions' => $byDay[$n] ?? [],
        ];
        $groups = $d['groups_json'] ? json_decode($d['groups_json'], true) : null;
        if (is_array($groups) && $groups) {
            $o['groups'] = $groups;
        }
        $days[] = $o;
    }

    $speakers = [];
    foreach ($pdo->query("SELECT * FROM agenda_speakers ORDER BY id ASC")->fetchAll() as $s) {
        $speakers[] = [
            'id' => (string) (int) $s['id'],
            'name' => $s['name'],
            'position' => $s['position'],
            'institution' => $s['institution'],
            'photo' => $s['photo_path'] ?? '',
            'bio' => $s['bio'] ?? '',
        ];
    }

    return ['days' => $days, 'speakers' => $speakers];
}

// -----------------------------------------------------------------
// Read
// -----------------------------------------------------------------
function agenda_public(PDO $pdo): void
{
    header('Cache-Control: no-store');
    json_response(agenda_payload($pdo));
}

function agenda_admin(PDO $pdo): void
{
    require_auth();
    header('Cache-Control: no-store');
    json_response(agenda_payload($pdo));
}

// -----------------------------------------------------------------
// Sessions
// -----------------------------------------------------------------
function agenda_session_save(PDO $pdo): void
{
    require_auth();
    $b = read_json_body();

    $id = (int) ($b['id'] ?? 0);
    $day = (int) ($b['day'] ?? 0);
    if (!in_array($day, EVENT_DAYS, true)) {
        json_error('Hari (1-3) tidak valid.', 422);
    }
    $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 300);
    if ($title === '') {
        json_error('Judul sesi wajib diisi.', 422);
    }
    $type = mb_substr(trim((string) ($b['type'] ?? '')), 0, 60) ?: 'Session';
    $room = mb_substr(trim((string) ($b['room'] ?? '')), 0, 120);
    $desc = trim((string) ($b['description'] ?? ''));
    $kind = ($b['kind'] ?? '') === 'break' ? 'break' : 'session';
    $group = mb_substr(trim((string) ($b['group'] ?? '')), 0, 60);
    $start = agenda_valid_time($b['start'] ?? '');
    $end = agenda_valid_time($b['end'] ?? '');
    if ($end && !$start) {
        json_error('Isi jam mulai jika jam selesai diisi.', 422);
    }

    $spk = [];
    foreach ((is_array($b['speakers'] ?? null) ? $b['speakers'] : []) as $sid) {
        $sid = (int) $sid;
        if ($sid > 0 && !in_array($sid, $spk, true)) {
            $spk[] = $sid;
        }
    }
    if ($spk) {
        $in = implode(',', array_fill(0, count($spk), '?'));
        $st = $pdo->prepare("SELECT id FROM agenda_speakers WHERE id IN ($in)");
        $st->execute($spk);
        $exist = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
        $spk = array_values(array_filter($spk, fn($x) => in_array($x, $exist, true)));
    }

    $pdo->beginTransaction();
    try {
        if ($id) {
            $st = $pdo->prepare("SELECT * FROM agenda_sessions WHERE id = ? FOR UPDATE");
            $st->execute([$id]);
            $row = $st->fetch();
            if (!$row) {
                $pdo->rollBack();
                json_error('Sesi tidak ditemukan.', 404);
            }
            $sort = (int) $row['day'] === $day ? (int) $row['sort_order'] : agenda_next_sort($pdo, $day);
            $pdo->prepare(
                "UPDATE agenda_sessions SET day=?, sort_order=?, start_time=?, end_time=?, type=?, room=?, title=?, description=?, kind=?, group_label=? WHERE id=?"
            )->execute([$day, $sort, $start, $end, $type, $room, $title, $desc, $kind, $group !== '' ? $group : null, $id]);
        } else {
            $pdo->prepare(
                "INSERT INTO agenda_sessions (day, sort_order, start_time, end_time, type, room, title, description, kind, group_label)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([$day, agenda_next_sort($pdo, $day), $start, $end, $type, $room, $title, $desc, $kind, $group !== '' ? $group : null]);
            $id = (int) $pdo->lastInsertId();
        }

        $pdo->prepare("DELETE FROM agenda_session_speakers WHERE session_id = ?")->execute([$id]);
        $ins = $pdo->prepare("INSERT INTO agenda_session_speakers (session_id, speaker_id, sort_order) VALUES (?, ?, ?)");
        foreach ($spk as $i => $sid) {
            $ins->execute([$id, $sid, $i]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    json_response(['ok' => true, 'id' => $id]);
}

function agenda_session_delete(PDO $pdo): void
{
    require_auth();
    $id = (int) (read_json_body()['id'] ?? 0);
    $st = $pdo->prepare("DELETE FROM agenda_sessions WHERE id = ?");
    $st->execute([$id]);
    if (!$st->rowCount()) {
        json_error('Sesi tidak ditemukan.', 404);
    }
    json_response(['ok' => true]);
}

function agenda_session_move(PDO $pdo): void
{
    require_auth();
    $b = read_json_body();
    $id = (int) ($b['id'] ?? 0);
    $dir = (int) ($b['dir'] ?? 0) < 0 ? -1 : 1;

    $st = $pdo->prepare("SELECT day, group_label FROM agenda_sessions WHERE id = ?");
    $st->execute([$id]);
    $cur = $st->fetch();
    if (!$cur) {
        json_error('Sesi tidak ditemukan.', 404);
    }

    $pdo->beginTransaction();
    try {
        // Urutan hanya ditukar di dalam grup yang sama (hari yang sama).
        $st = $pdo->prepare("SELECT id, sort_order FROM agenda_sessions WHERE day = ? AND group_label <=> ? ORDER BY sort_order, id FOR UPDATE");
        $st->execute([(int) $cur['day'], $cur['group_label']]);
        $rows = $st->fetchAll();
        $ids = array_map('intval', array_column($rows, 'id'));
        $orders = array_map('intval', array_column($rows, 'sort_order'));
        $i = array_search($id, $ids, true);
        $j = $i === false ? -1 : $i + $dir;
        if ($i !== false && $j >= 0 && $j < count($ids)) {
            [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
            $up = $pdo->prepare("UPDATE agenda_sessions SET sort_order = ? WHERE id = ?");
            foreach ($ids as $n => $sid) {
                $up->execute([$orders[$n], $sid]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    json_response(['ok' => true]);
}

// -----------------------------------------------------------------
// Days
// -----------------------------------------------------------------
function agenda_day_save(PDO $pdo): void
{
    require_auth();
    $b = read_json_body();
    $day = (int) ($b['day'] ?? 0);
    if (!in_array($day, EVENT_DAYS, true)) {
        json_error('Hari (1-3) tidak valid.', 422);
    }
    $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 200);
    $date = mb_substr(trim((string) ($b['date'] ?? '')), 0, 60);

    $groups = [];
    foreach (preg_split('/\r\n|\r|\n/', (string) ($b['groups'] ?? '')) as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $p = array_map('trim', explode('|', $line, 2));
        $label = mb_substr($p[0], 0, 60);
        if ($label === '') {
            continue;
        }
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($label)), '-');
        $groups[] = ['id' => $slug ?: 'group-' . (count($groups) + 1), 'label' => $label, 'title' => $p[1] ?? ''];
    }

    // Ganti nama grup di baris yang sama -> sesi di grup itu ikut dipindah ke nama baru.
    $o = $pdo->prepare("SELECT groups_json FROM agenda_days WHERE day = ?");
    $o->execute([$day]);
    $oldGroups = json_decode((string) $o->fetchColumn(), true) ?: [];
    $newLabels = array_column($groups, 'label');
    $ren = $pdo->prepare("UPDATE agenda_sessions SET group_label = ? WHERE day = ? AND group_label = ?");
    foreach ($oldGroups as $i => $og) {
        $ol = $og['label'] ?? '';
        if ($ol !== '' && isset($groups[$i]) && $groups[$i]['label'] !== $ol && !in_array($ol, $newLabels, true)) {
            $ren->execute([$groups[$i]['label'], $day, $ol]);
        }
    }

    $pdo->prepare("UPDATE agenda_days SET title = ?, date_label = ?, groups_json = ? WHERE day = ?")
        ->execute([$title, $date, $groups ? json_encode($groups, JSON_UNESCAPED_UNICODE) : null, $day]);
    json_response(['ok' => true]);
}

// -----------------------------------------------------------------
// Speakers (multipart: foto opsional)
// -----------------------------------------------------------------
function agenda_speaker_save(PDO $pdo): void
{
    require_auth();

    $id = (int) ($_POST['id'] ?? 0);
    $name = mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 200);
    if ($name === '') {
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 && empty($_POST) && empty($_FILES)) {
            json_error('Ukuran upload melebihi post_max_size di php.ini.', 413);
        }
        json_error('Nama pembicara wajib diisi.', 422);
    }
    $position = mb_substr(trim((string) ($_POST['position'] ?? '')), 0, 300);
    $institution = mb_substr(trim((string) ($_POST['institution'] ?? '')), 0, 300);
    $bio = trim((string) ($_POST['bio'] ?? ''));
    $remove = !empty($_POST['removePhoto']);

    $row = null;
    if ($id) {
        $st = $pdo->prepare("SELECT * FROM agenda_speakers WHERE id = ?");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            json_error('Pembicara tidak ditemukan.', 404);
        }
    }

    // Foto baru (opsional)
    $newPhoto = null;
    $f = $_FILES['photo'] ?? null;
    if ($f && !is_array($f['error']) && $f['error'] !== UPLOAD_ERR_NO_FILE) {
        if ($f['error'] !== UPLOAD_ERR_OK) {
            json_error('Upload foto gagal (kode ' . (int) $f['error'] . '). Cek upload_max_filesize di php.ini.', 422);
        }
        if (!is_uploaded_file($f['tmp_name'])) {
            json_error('Upload tidak valid.', 422);
        }
        if ((int) $f['size'] > AGENDA_MAX_PHOTO) {
            json_error('Foto terlalu besar (maks. 3 MB).', 422);
        }
        if (!class_exists('finfo')) {
            json_error('Ekstensi PHP fileinfo belum aktif.', 500);
        }
        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        if (!isset(AGENDA_PHOTO_MIMES[$mime])) {
            json_error('Format foto harus JPG, PNG, atau WEBP.', 422);
        }
        $fname = bin2hex(random_bytes(12)) . '.' . AGENDA_PHOTO_MIMES[$mime];
        if (!move_uploaded_file($f['tmp_name'], agenda_upload_dir() . '/' . $fname)) {
            json_error('Gagal menyimpan foto. Cek izin tulis folder ' . AGENDA_UPLOAD_REL . '.', 500);
        }
        $newPhoto = AGENDA_UPLOAD_REL . '/' . $fname;
    }

    try {
        if ($row) {
            $photo = $row['photo_path'];
            if ($newPhoto) {
                $photo = $newPhoto;
            } elseif ($remove) {
                $photo = null;
            }
            $pdo->prepare("UPDATE agenda_speakers SET name=?, position=?, institution=?, photo_path=?, bio=? WHERE id=?")
                ->execute([$name, $position, $institution, $photo, $bio, $id]);
            if ($photo !== $row['photo_path']) {
                agenda_unlink($row['photo_path']);
            }
        } else {
            $pdo->prepare("INSERT INTO agenda_speakers (name, position, institution, photo_path, bio) VALUES (?, ?, ?, ?, ?)")
                ->execute([$name, $position, $institution, $newPhoto, $bio]);
            $id = (int) $pdo->lastInsertId();
        }
    } catch (Throwable $e) {
        agenda_unlink($newPhoto);
        throw $e;
    }
    json_response(['ok' => true, 'id' => $id]);
}

function agenda_speaker_delete(PDO $pdo): void
{
    require_auth();
    $id = (int) (read_json_body()['id'] ?? 0);
    $st = $pdo->prepare("SELECT photo_path FROM agenda_speakers WHERE id = ?");
    $st->execute([$id]);
    $photo = $st->fetchColumn();
    if ($photo === false) {
        json_error('Pembicara tidak ditemukan.', 404);
    }
    $pdo->prepare("DELETE FROM agenda_speakers WHERE id = ?")->execute([$id]); // relasi sesi ikut terhapus (CASCADE)
    agenda_unlink($photo ?: null);
    json_response(['ok' => true]);
}