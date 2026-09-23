<?php
/**
 * index.php — front controller / router.
 * Every request to /api/* is rewritten here by .htaccess.
 *
 * Routes:
 *   GET  /api/status
 *   POST /api/register
 *   POST /api/login             (public)
 *   POST /api/logout            (staff)
 *   GET  /api/me                (staff)
 *   GET  /api/participants               (staff only)
 *   GET  /api/participants/search?q=...  (staff only)
 *   POST /api/checkin                    (staff only)
 *   GET  /api/settings                   (staff only)
 *   POST /api/settings                   (staff only)
 */

require __DIR__ . '/config.php';

apply_cors();

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = trim($path, '/');
$path = preg_replace('#^api/#', '', $path); // strip leading "api/" if present
$segments = $path === '' ? [] : explode('/', $path);
$route = $segments[0] ?? '';
$sub = $segments[1] ?? '';

try {
    $pdo = db();

    if ($route === 'status' && $method === 'GET') {
        handle_status($pdo);
    } elseif ($route === 'register' && $method === 'POST') {
        handle_register($pdo);
    } elseif ($route === 'login' && $method === 'POST') {
        handle_login($pdo);
    } elseif ($route === 'logout' && $method === 'POST') {
        handle_logout();
    } elseif ($route === 'me' && $method === 'GET') {
        handle_me();
    } elseif ($route === 'participants' && $sub === 'search' && $method === 'GET') {
        handle_search_participants($pdo);
    } elseif ($route === 'participants' && $method === 'GET') {
        handle_list_participants($pdo);
    } elseif ($route === 'checkin' && $method === 'POST') {
        handle_checkin($pdo);
    } elseif ($route === 'settings' && $method === 'GET') {
        handle_get_settings($pdo);
    } elseif ($route === 'settings' && $method === 'POST') {
        handle_save_settings($pdo);
    } else {
        json_error('Not found: ' . $method . ' /' . $path, 404);
    }
} catch (PDOException $e) {
    json_error('Database error: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
    json_error('Server error: ' . $e->getMessage(), 500);
}

// =================================================================
// Handlers
// =================================================================

function handle_status(PDO $pdo): void {
    $status = evaluate_registration_status($pdo);
    json_response($status);
}

// -----------------------------------------------------------------
// Auth
// -----------------------------------------------------------------
function handle_login(PDO $pdo): void {
    start_session();
    $body = read_json_body();
    $email = trim($body['email'] ?? '');
    $password = (string)($body['password'] ?? '');

    if (!$email || !$password) {
        json_error('Email and password are required.', 422);
    }

    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Always run password_verify even on a missing user (against a dummy hash)
    // so response timing doesn't reveal whether the email exists.
    $hash = $user['password_hash'] ?? '$2y$10$invalidinvalidinvaliduinvalidinvalidinvalidinvalidinv';
    $valid = password_verify($password, $hash);

    if (!$user || !$valid) {
        json_error('Invalid email or password.', 401);
    }

    session_regenerate_id(true); // prevent session fixation
    $_SESSION['admin_id'] = $user['id'];
    $_SESSION['admin_nama'] = $user['nama'];
    $_SESSION['admin_email'] = $user['email'];

    json_response(['id' => $user['id'], 'nama' => $user['nama'], 'email' => $user['email']]);
}

function handle_logout(): void {
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    json_response(['ok' => true]);
}

function handle_me(): void {
    $user = require_auth();
    json_response($user);
}

function handle_register(PDO $pdo): void {
    $body = read_json_body();
    $fullname  = trim($body['fullname'] ?? '');
    $email     = trim($body['email'] ?? '');
    $phone     = trim($body['phone'] ?? '');
    $country   = trim($body['country'] ?? '');
    $company   = trim($body['company'] ?? '');
    $jobtitle  = trim($body['jobtitle'] ?? '');
    $segment   = trim($body['segment'] ?? '');
    $segmentOther  = trim($body['segmentOther'] ?? '');
    $industry      = trim($body['industry'] ?? '');
    $industryOther = trim($body['industryOther'] ?? '');
    $experience    = trim($body['experience'] ?? '');
    $goals     = is_array($body['goals'] ?? null) ? $body['goals'] : [];
    $access    = trim($body['access'] ?? '');
    $marketing  = !empty($body['marketing']);
    $thirdparty = !empty($body['thirdparty']);
    $terms      = !empty($body['terms']);

    // Required fields — mirrors the `required` attributes in registration.html
    if (!$fullname || !$email || !$phone || !$country || !$company || !$jobtitle || !$segment || !$experience) {
        json_error('All required fields must be filled.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Invalid email format.', 422);
    }
    if ($segment === 'Others' && !$segmentOther) {
        json_error('Please specify your segment.', 422);
    }
    if ($industry === 'Lainnya' && !$industryOther) {
        json_error('Please specify your industry.', 422);
    }
    if (!$terms) {
        json_error('You must accept the Terms & Conditions.', 422);
    }

    // Re-check status server-side — never trust the client's earlier /status check.
    $status = evaluate_registration_status($pdo);
    if (!$status['open']) {
        json_response($status, 423); // Locked
    }

    // Duplicate email? Return the existing ticket instead of creating a new one.
    $stmt = $pdo->prepare("SELECT * FROM peserta WHERE email = ?");
    $stmt->execute([$email]);
    $existing = $stmt->fetch();
    if ($existing) {
        json_response(['participant' => map_participant($existing)], 409);
    }

    $pdo->beginTransaction();
    try {
        $id = next_participant_id($pdo);
        $qrToken = generate_qr_token();

        $insert = $pdo->prepare(
            "INSERT INTO peserta
                (id, fullname, email, phone, country, company, jobtitle, segment, segment_other,
                 industry, industry_other, experience, goals, access_needs,
                 marketing_consent, thirdparty_consent, terms_accepted, qr_token, kehadiran)
             VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)"
        );
        $insert->execute([
            $id, $fullname, $email, $phone, $country, $company, $jobtitle, $segment, $segmentOther ?: null,
            $industry ?: null, $industryOther ?: null, $experience, implode(',', $goals), $access ?: null,
            $marketing ? 1 : 0, $thirdparty ? 1 : 0, $terms ? 1 : 0, $qrToken,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $stmt = $pdo->prepare("SELECT * FROM peserta WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    json_response(['participant' => map_participant($row)], 201);
}

function handle_list_participants(PDO $pdo): void {
    require_auth();
    $rows = $pdo->query("SELECT * FROM peserta ORDER BY nama_lengkap ASC")->fetchAll();
    json_response(array_map('map_participant', $rows));
}

function handle_search_participants(PDO $pdo): void {
    require_auth();
    $q = trim($_GET['q'] ?? '');
    if ($q === '') {
        json_response([]);
    }
    $like = '%' . $q . '%';
    $stmt = $pdo->prepare(
        "SELECT * FROM peserta
         WHERE nama_lengkap LIKE ? OR email LIKE ? OR id LIKE ?
         ORDER BY nama_lengkap ASC"
    );
    $stmt->execute([$like, $like, $like]);
    json_response(array_map('map_participant', $stmt->fetchAll()));
}

function handle_checkin(PDO $pdo): void {
    $staff = require_auth();
    $body = read_json_body();
    $qrToken = trim($body['qrToken'] ?? '');
    $staffName = $staff['nama']; // trust the logged-in session, not client input

    if (!$qrToken) {
        json_error('qrToken is required.', 422);
    }

    $stmt = $pdo->prepare("SELECT * FROM peserta WHERE qr_token = ?");
    $stmt->execute([$qrToken]);
    $row = $stmt->fetch();

    if (!$row) {
        json_error('QR token not found.', 404);
    }
    if ((bool)$row['kehadiran']) {
        json_response([
            'error' => 'Already checked in.',
            'participant' => map_participant($row),
        ], 409);
    }

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare(
            "UPDATE peserta
             SET kehadiran = TRUE, waktu_checkin = NOW(), checkin_oleh = ?
             WHERE qr_token = ? AND kehadiran = FALSE"
        );
        $update->execute([$staffName, $qrToken]);

        if ($update->rowCount() === 0) {
            // Someone else checked this participant in a split second earlier.
            $pdo->rollBack();
            $stmt->execute([$qrToken]);
            json_response([
                'error' => 'Already checked in.',
                'participant' => map_participant($stmt->fetch()),
            ], 409);
        }

        $log = $pdo->prepare(
            "INSERT INTO checkin_log (peserta_id, staff_name) VALUES (?, ?)"
        );
        $log->execute([$row['id'], $staffName]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $stmt->execute([$qrToken]);
    json_response(['participant' => map_participant($stmt->fetch())]);
}

function handle_get_settings(PDO $pdo): void {
    require_auth();
    $row = $pdo->query("SELECT quota, deadline, force_closed FROM registration_settings WHERE id = 1")->fetch();
    if (!$row) {
        json_response(['quota' => null, 'deadline' => null]);
    }
    json_response([
        'quota'    => $row['quota'] !== null ? (int)$row['quota'] : null,
        'deadline' => $row['deadline'],
    ]);
}

function handle_save_settings(PDO $pdo): void {
    require_auth();
    $body = read_json_body();
    $quota = array_key_exists('quota', $body) && $body['quota'] !== null ? max(0, (int)$body['quota']) : null;
    $deadline = !empty($body['deadline']) ? $body['deadline'] : null;

    $stmt = $pdo->prepare(
        "UPDATE registration_settings SET quota = ?, deadline = ?, updated_at = NOW() WHERE id = 1"
    );
    $stmt->execute([$quota, $deadline]);

    json_response(['quota' => $quota, 'deadline' => $deadline]);
}
