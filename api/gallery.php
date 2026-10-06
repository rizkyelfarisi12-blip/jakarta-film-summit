<?php
/**
 * gallery.php — endpoint Gallery (di-require oleh index.php).
 *
 * Routes (semua di bawah /api/gallery):
 *   GET  /api/gallery            publik   -> hari + media yang is_published = 1
 *   GET  /api/gallery/admin      staff    -> semua media (termasuk draft)
 *   POST /api/gallery/upload     staff    -> multipart: file, [thumb], day, title, caption, session, takenAt
 *   POST /api/gallery/update     staff    -> JSON: id, title, caption, session, day, takenAt, videoUrl, published
 *   POST /api/gallery/delete     staff    -> JSON: id
 */

const GALLERY_FALLBACK_IMAGE = 'assets/gallery/hero_bg.jpeg';
const GALLERY_UPLOAD_REL = 'uploads/gallery';
const GALLERY_MAX_IMAGE = 15 * 1024 * 1024;   // 15 MB
const GALLERY_MAX_VIDEO = 300 * 1024 * 1024;  // 300 MB
const GALLERY_MAX_THUMB = 3 * 1024 * 1024;    // 3 MB
const GALLERY_MIMES = [
    'image/jpeg' => ['photo', 'jpg'],
    'image/png' => ['photo', 'png'],
    'image/webp' => ['photo', 'webp'],
    'video/mp4' => ['video', 'mp4'],
    'video/quicktime' => ['video', 'mov'],
];

function handle_gallery(PDO $pdo, string $method, string $sub): void
{
    if ($sub === '' && $method === 'GET') {
        gallery_public($pdo);
    } elseif ($sub === 'admin' && $method === 'GET') {
        gallery_admin($pdo);
    } elseif ($sub === 'upload' && $method === 'POST') {
        gallery_upload($pdo);
    } elseif ($sub === 'update' && $method === 'POST') {
        gallery_update($pdo);
    } elseif ($sub === 'delete' && $method === 'POST') {
        gallery_delete($pdo);
    } else {
        json_error('Not found: ' . $method . ' /gallery/' . $sub, 404);
    }
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
/** Root website (folder yang berisi assets/ dan uploads/). */
function gallery_site_root(): string
{
    return is_dir(__DIR__ . '/assets') ? __DIR__ : dirname(__DIR__);
}

function gallery_upload_dir(): string
{
    $dir = gallery_site_root() . '/' . GALLERY_UPLOAD_REL;
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        json_error('Folder upload tidak bisa dibuat: ' . GALLERY_UPLOAD_REL, 500);
    }
    // Pastikan skrip tidak bisa dieksekusi dari folder upload.
    $ht = $dir . '/.htaccess';
    if (!is_file($ht)) {
        @file_put_contents($ht, "Options -Indexes -ExecCGI\n<FilesMatch \"\\.(php|phtml|php[0-9]?|phar|pl|py|cgi|sh|html?|js)$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n<IfModule mod_php7.c>\n  php_flag engine off\n</IfModule>\n<IfModule mod_php8.c>\n  php_flag engine off\n</IfModule>\n");
    }
    return $dir;
}

function gallery_map_media(array $r): array
{
    $isVideo = $r['type'] === 'video';
    $file = $r['file_path'] ?: '';
    $thumb = $r['thumb_path'] ?: '';
    $ts = strtotime($r['taken_at']);
    return [
        'id' => (int) $r['id'],
        'day' => (int) $r['day'],
        'type' => $r['type'],
        'title' => $r['title'],
        'caption' => $r['caption'] ?? '',
        'session' => $r['session'] ?? '',
        'timestamp' => date('d M Y · H.i', $ts),
        'takenAt' => date('Y-m-d\TH:i:s', $ts),
        'image' => $isVideo ? ($thumb ?: GALLERY_FALLBACK_IMAGE) : ($file ?: GALLERY_FALLBACK_IMAGE),
        'hasThumb' => $isVideo && $thumb !== '',
        'src' => $isVideo ? ($file ?: ($r['video_url'] ?: '')) : '',
        'videoUrl' => $r['video_url'] ?? '',
        'size' => $r['size_bytes'] !== null ? (int) $r['size_bytes'] : null,
        'published' => (bool) $r['is_published'],
    ];
}

function gallery_payload(PDO $pdo, bool $includeDrafts): array
{
    $days = $pdo->query("SELECT * FROM gallery_days ORDER BY day ASC")->fetchAll();
    $sql = "SELECT * FROM gallery_media" . ($includeDrafts ? '' : " WHERE is_published = 1")
        . " ORDER BY taken_at DESC, id DESC";
    $by = [];
    foreach ($pdo->query($sql)->fetchAll() as $r) {
        $by[(int) $r['day']][] = gallery_map_media($r);
    }
    $out = [];
    foreach ($days as $d) {
        $n = (int) $d['day'];
        $out[] = [
            'id' => 'day-' . $n,
            'day' => $n,
            'label' => $d['label'],
            'date' => $d['date_label'],
            'intro' => $d['intro'] ?? '',
            'media' => $by[$n] ?? [],
        ];
    }
    return ['event' => 'Jakarta Film Summit 2026', 'days' => $out];
}

function gallery_get_row(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare("SELECT * FROM gallery_media WHERE id = ?");
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function gallery_parse_datetime($raw): string
{
    $raw = trim((string) $raw);
    $ts = $raw === '' ? false : strtotime(str_replace('T', ' ', $raw));
    return date('Y-m-d H:i:s', $ts !== false ? $ts : time());
}

/** Hapus file hanya kalau berada di uploads/gallery (file bawaan assets/ tidak disentuh). */
function gallery_unlink(?string $rel): void
{
    if (!$rel || !preg_match('#^' . preg_quote(GALLERY_UPLOAD_REL, '#') . '/[A-Za-z0-9._-]+$#', $rel)) {
        return;
    }
    $path = gallery_site_root() . '/' . $rel;
    if (is_file($path)) {
        @unlink($path);
    }
}

function gallery_upload_error_message(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'File melebihi batas upload server (upload_max_filesize di php.ini).';
        case UPLOAD_ERR_PARTIAL:
            return 'File hanya terunggah sebagian. Coba lagi.';
        case UPLOAD_ERR_NO_FILE:
            return 'Tidak ada file yang dipilih.';
        case UPLOAD_ERR_NO_TMP_DIR:
        case UPLOAD_ERR_CANT_WRITE:
            return 'Server tidak bisa menyimpan file sementara.';
        default:
            return 'Upload gagal (kode ' . $code . ').';
    }
}

function gallery_detect_mime(string $path): string
{
    if (!class_exists('finfo')) {
        json_error('Ekstensi PHP fileinfo belum aktif. Aktifkan extension=fileinfo di php.ini.', 500);
    }
    $f = new finfo(FILEINFO_MIME_TYPE);
    return (string) $f->file($path);
}

// -----------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------
function gallery_public(PDO $pdo): void
{
    header('Cache-Control: no-store');
    json_response(gallery_payload($pdo, false));
}

function gallery_admin(PDO $pdo): void
{
    require_auth();
    header('Cache-Control: no-store');
    json_response(gallery_payload($pdo, true));
}

function gallery_upload(PDO $pdo): void
{
    $staff = require_auth();

    if (empty($_FILES['file'])) {
        // post_max_size terlampaui -> PHP mengosongkan $_POST dan $_FILES.
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 && empty($_POST)) {
            json_error('Ukuran upload melebihi post_max_size di php.ini. Naikkan post_max_size dan upload_max_filesize.', 413);
        }
        json_error('File tidak ditemukan.', 422);
    }
    $f = $_FILES['file'];
    if (!is_array($f['error']) && $f['error'] !== UPLOAD_ERR_OK) {
        json_error(gallery_upload_error_message((int) $f['error']), 422);
    }
    if (is_array($f['error']) || !is_uploaded_file($f['tmp_name'])) {
        json_error('Upload tidak valid.', 422);
    }

    $day = (int) ($_POST['day'] ?? 0);
    if (!in_array($day, EVENT_DAYS, true)) {
        json_error('Hari (1-3) tidak valid.', 422);
    }

    $mime = gallery_detect_mime($f['tmp_name']);
    if (!isset(GALLERY_MIMES[$mime])) {
        json_error('Format file tidak didukung. Gunakan JPG, PNG, WEBP, MP4, atau MOV.', 422);
    }
    [$type, $ext] = GALLERY_MIMES[$mime];
    $limit = $type === 'video' ? GALLERY_MAX_VIDEO : GALLERY_MAX_IMAGE;
    if ((int) $f['size'] > $limit) {
        json_error('File terlalu besar (maks. ' . round($limit / 1048576) . ' MB untuk ' . ($type === 'video' ? 'video' : 'foto') . ').', 422);
    }

    $title = trim((string) ($_POST['title'] ?? ''));
    if ($title === '') {
        $title = pathinfo((string) $f['name'], PATHINFO_FILENAME);
        $title = trim(preg_replace('/[_\-\s]+/u', ' ', $title));
        if ($title === '') {
            $title = $type === 'video' ? 'Video' : 'Foto';
        }
    }
    $title = mb_substr($title, 0, 200);
    $caption = trim((string) ($_POST['caption'] ?? ''));
    $session = mb_substr(trim((string) ($_POST['session'] ?? '')), 0, 120);
    $takenAt = gallery_parse_datetime($_POST['takenAt'] ?? '');

    $dir = gallery_upload_dir();
    $base = bin2hex(random_bytes(12));
    $name = $base . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        json_error('Gagal menyimpan file di server. Cek izin tulis folder ' . GALLERY_UPLOAD_REL . '.', 500);
    }
    $filePath = GALLERY_UPLOAD_REL . '/' . $name;

    // Poster video (opsional, dibuat di browser admin).
    $thumbPath = null;
    if (
        $type === 'video' && !empty($_FILES['thumb']) && !is_array($_FILES['thumb']['error'])
        && $_FILES['thumb']['error'] === UPLOAD_ERR_OK && is_uploaded_file($_FILES['thumb']['tmp_name'])
        && (int) $_FILES['thumb']['size'] <= GALLERY_MAX_THUMB
        && gallery_detect_mime($_FILES['thumb']['tmp_name']) === 'image/jpeg'
    ) {
        $tn = $base . '-thumb.jpg';
        if (move_uploaded_file($_FILES['thumb']['tmp_name'], $dir . '/' . $tn)) {
            $thumbPath = GALLERY_UPLOAD_REL . '/' . $tn;
        }
    }

    try {
        $st = $pdo->prepare(
            "INSERT INTO gallery_media
                (day, type, title, caption, session, taken_at, file_path, thumb_path, mime, size_bytes, is_published, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)"
        );
        $st->execute([$day, $type, $title, $caption, $session, $takenAt, $filePath, $thumbPath, $mime, (int) $f['size'], $staff['nama']]);
    } catch (Throwable $e) {
        gallery_unlink($filePath);
        gallery_unlink($thumbPath);
        throw $e;
    }

    $row = gallery_get_row($pdo, (int) $pdo->lastInsertId());
    json_response(['item' => gallery_map_media($row)], 201);
}

function gallery_update(PDO $pdo): void
{
    require_auth();
    $b = read_json_body();
    $id = (int) ($b['id'] ?? 0);
    $row = $id ? gallery_get_row($pdo, $id) : null;
    if (!$row) {
        json_error('Media tidak ditemukan.', 404);
    }

    $set = [];
    $val = [];
    if (array_key_exists('title', $b)) {
        $t = mb_substr(trim((string) $b['title']), 0, 200);
        if ($t === '') {
            json_error('Judul tidak boleh kosong.', 422);
        }
        $set[] = 'title = ?';
        $val[] = $t;
    }
    if (array_key_exists('caption', $b)) {
        $set[] = 'caption = ?';
        $val[] = trim((string) $b['caption']);
    }
    if (array_key_exists('session', $b)) {
        $set[] = 'session = ?';
        $val[] = mb_substr(trim((string) $b['session']), 0, 120);
    }
    if (array_key_exists('day', $b)) {
        $d = (int) $b['day'];
        if (!in_array($d, EVENT_DAYS, true)) {
            json_error('Hari (1-3) tidak valid.', 422);
        }
        $set[] = 'day = ?';
        $val[] = $d;
    }
    if (array_key_exists('takenAt', $b)) {
        $set[] = 'taken_at = ?';
        $val[] = gallery_parse_datetime($b['takenAt']);
    }
    if (array_key_exists('videoUrl', $b)) {
        $u = trim((string) $b['videoUrl']);
        if ($u !== '' && !preg_match('#^https?://#i', $u)) {
            json_error('URL video harus diawali http:// atau https://', 422);
        }
        $set[] = 'video_url = ?';
        $val[] = $u !== '' ? mb_substr($u, 0, 500) : null;
    }
    if (array_key_exists('published', $b)) {
        $set[] = 'is_published = ?';
        $val[] = $b['published'] ? 1 : 0;
    }
    if (!$set) {
        json_error('Tidak ada perubahan.', 422);
    }

    $val[] = $id;
    $pdo->prepare('UPDATE gallery_media SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($val);
    json_response(['item' => gallery_map_media(gallery_get_row($pdo, $id))]);
}

function gallery_delete(PDO $pdo): void
{
    require_auth();
    $b = read_json_body();
    $id = (int) ($b['id'] ?? 0);
    $row = $id ? gallery_get_row($pdo, $id) : null;
    if (!$row) {
        json_error('Media tidak ditemukan.', 404);
    }
    $pdo->prepare('DELETE FROM gallery_media WHERE id = ?')->execute([$id]);
    gallery_unlink($row['file_path']);
    gallery_unlink($row['thumb_path']);
    json_response(['ok' => true]);
}
