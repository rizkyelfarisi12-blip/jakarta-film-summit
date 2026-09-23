<?php
/**
 * config.php
 * Database connection + small shared helpers.
 * Edit the DB_* constants below to match your MySQL setup.
 */

// ---------------------------------------------------------------
// Database credentials — EDIT THESE for your server
// ---------------------------------------------------------------
define('DB_HOST', 'localhost');
define('DB_NAME', 'jfs');   // matches schema.sql
define('DB_USER', 'root');
define('DB_PASS', '');

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// ---------------------------------------------------------------
// Session (staff login)
// ---------------------------------------------------------------
function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $isHttps,   // cookie only sent over HTTPS in production
        'httponly' => true,       // not readable from JS — mitigates XSS token theft
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** Call at the top of any staff-only endpoint. Sends 401 and stops if not logged in. */
function require_auth(): array {
    start_session();
    if (empty($_SESSION['admin_id'])) {
        json_error('Unauthorized — please log in.', 401);
    }
    return [
        'id'    => $_SESSION['admin_id'],
        'nama'  => $_SESSION['admin_nama'],
        'email' => $_SESSION['admin_email'],
    ];
}

// ---------------------------------------------------------------
// CORS — allow the frontend to call this API from any origin.
// Tighten Access-Control-Allow-Origin to your real domain in production.
// ---------------------------------------------------------------
function apply_cors(): void {
    // Reflect the request origin (required for cookies/credentials to work —
    // "Access-Control-Allow-Origin: *" is not allowed together with credentials).
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------
function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_response(['error' => $message], $status);
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ---------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------
function generate_qr_token(): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
    $token = '';
    for ($i = 0; $i < 10; $i++) {
        $token .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $token;
}

/** Map a `peserta` DB row (snake_case) to the JSON shape the frontend expects. */
function map_participant(array $row): array {
    return [
        'id'                 => $row['id'],
        'fullname'           => $row['fullname'],
        'email'              => $row['email'],
        'phone'              => $row['phone'],
        'country'            => $row['country'],
        'company'            => $row['company'],
        'jobtitle'           => $row['jobtitle'],
        'segment'            => $row['segment'],
        'segmentOther'       => $row['segment_other'],
        'industry'           => $row['industry'],
        'industryOther'      => $row['industry_other'],
        'experience'         => $row['experience'],
        'goals'              => $row['goals'] ? explode(',', $row['goals']) : [],
        'access'             => $row['access_needs'],
        'marketing'          => (bool)$row['marketing_consent'],
        'thirdparty'         => (bool)$row['thirdparty_consent'],
        'qrToken'            => $row['qr_token'],
        'kehadiran'          => (bool)$row['kehadiran'],
        'waktu_checkin'      => $row['waktu_checkin'],
        'checkin_oleh'       => $row['checkin_oleh'],
    ];
}

/** Generate the next JFS-2026-#### id. Called inside a transaction with a row lock for safety. */
function next_participant_id(PDO $pdo): string {
    $stmt = $pdo->query("SELECT id FROM peserta ORDER BY id DESC LIMIT 1 FOR UPDATE");
    $last = $stmt->fetchColumn();
    $nextNum = 1;
    if ($last) {
        $parts = explode('-', $last);
        $n = intval(end($parts));
        $nextNum = $n + 1;
    }
    return 'JFS-2026-' . str_pad((string)$nextNum, 4, '0', STR_PAD_LEFT);
}

/** Evaluate whether registration is currently open. Returns [open, reason, settings, total]. */
function evaluate_registration_status(PDO $pdo): array {
    $total = (int)$pdo->query("SELECT COUNT(*) FROM peserta")->fetchColumn();
    $settings = $pdo->query("SELECT quota, deadline, force_closed FROM registration_settings WHERE id = 1")
                     ->fetch();
    if (!$settings) {
        $settings = ['quota' => null, 'deadline' => null, 'force_closed' => 0];
    }

    $quota = $settings['quota'] !== null ? (int)$settings['quota'] : null;
    $deadline = $settings['deadline'];
    $forceClosed = (bool)$settings['force_closed'];

    $quotaReached = $quota !== null && $total >= $quota;
    $deadlinePassed = $deadline !== null && strtotime($deadline) < time();

    $reason = null;
    if ($forceClosed) $reason = 'manual';
    elseif ($quotaReached) $reason = 'quota';
    elseif ($deadlinePassed) $reason = 'deadline';

    return [
        'open'     => $reason === null,
        'reason'   => $reason,
        'quota'    => $quota,
        'deadline' => $deadline,
        'total'    => $total,
    ];
}
