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
 *   POST /api/participants/days          (staff only) change a participant's days
 *   POST /api/checkin                    (staff only) {qrToken, day}
 *   GET  /api/display/latest?key=...     (welcome screen, protected by DISPLAY_KEY)
 *   GET  /api/settings                   (staff only)
 *   POST /api/settings                   (staff only)
 */

require __DIR__ . '/config.php';

apply_cors();

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = trim($path, '/');

$apiPos = strpos($path, 'api/');

if ($apiPos !== false) {
    $path = substr($path, $apiPos + 4);
}
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
    } elseif ($route === 'participants' && $sub === 'days' && $method === 'POST') {
        handle_update_days($pdo);
    } elseif ($route === 'participants' && $method === 'GET') {
        handle_list_participants($pdo);
    } elseif ($route === 'checkin' && $method === 'POST') {
        handle_checkin($pdo);
    } elseif ($route === 'display' && $sub === 'latest' && $method === 'GET') {
        handle_display_latest($pdo);
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

function handle_status(PDO $pdo): void
{
    // Public endpoint: only expose labels, never raw quota numbers.
    $s = evaluate_registration_status($pdo);
    $days = array_map(function ($d) {
        $o = ['day' => $d['day'], 'status' => $d['status'], 'open' => $d['open']];
        if ($d['status'] === 'low')
            $o['remaining'] = $d['remaining'];
        return $o;
    }, $s['days']);
    json_response([
        'open' => $s['open'],
        'reason' => $s['reason'],
        'quota' => null,
        'deadline' => $s['deadline'],
        'total' => $s['total'],
        'days' => $days,
    ]);
}

// -----------------------------------------------------------------
// Auth
// -----------------------------------------------------------------
function handle_login(PDO $pdo): void
{
    start_session();
    $body = read_json_body();
    $email = trim($body['email'] ?? '');
    $password = (string) ($body['password'] ?? '');

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

function handle_logout(): void
{
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    json_response(['ok' => true]);
}

function handle_me(): void
{
    $user = require_auth();
    json_response($user);
}

function handle_register(PDO $pdo): void
{
    $body = read_json_body();
    $fullname = trim($body['fullname'] ?? '');
    $email = trim($body['email'] ?? '');
    $phone = trim($body['phone'] ?? '');
    $country = trim($body['country'] ?? '');
    $company = trim($body['company'] ?? '');
    $jobtitle = trim($body['jobtitle'] ?? '');
    $segment = trim($body['segment'] ?? '');
    $segmentOther = trim($body['segmentOther'] ?? '');
    $industry = trim($body['industry'] ?? '');
    $industryOther = trim($body['industryOther'] ?? '');
    $experience = trim($body['experience'] ?? '');
    $goals = is_array($body['goals'] ?? null) ? $body['goals'] : [];
    $access = trim($body['access'] ?? '');
    $days = normalize_days($body['days'] ?? []);
    $marketing = !empty($body['marketing']);
    $thirdparty = !empty($body['thirdparty']);
    $terms = !empty($body['terms']);

    if (!$fullname || !$email || !$country) {
        json_error('All required fields must be filled.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Invalid email format.', 422);
    }
    if (!$days) {
        json_error('Please select at least one day to attend.', 422);
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

    $status = evaluate_registration_status($pdo);
    if (!$status['open']) {
        json_response($status, 423);
    }

    // Duplicate email? Return the existing ticket instead of creating a new one.
    $stmt = $pdo->prepare("SELECT * FROM peserta WHERE email = ?");
    $stmt->execute([$email]);
    $existing = $stmt->fetch();
    if ($existing) {
        json_response(['participant' => participant_json($pdo, $existing)], 409);
    }

    $pdo->beginTransaction();
    try {
        // Lock the per-day quota rows so simultaneous sign-ups cannot exceed a quota.
        $pdo->query("SELECT day FROM day_settings FOR UPDATE")->fetchAll();
        $quotas = day_quotas($pdo);
        $fullDays = [];
        foreach ($days as $d) {
            if ($quotas[$d] !== null && day_taken($pdo, $d) >= $quotas[$d])
                $fullDays[] = $d;
        }
        if ($fullDays) {
            $pdo->rollBack();
            json_response([
                'error' => 'Quota is full for Day ' . implode(', Day ', $fullDays) . '.',
                'fullDays' => $fullDays,
            ], 422);
        }

        $id = next_participant_id($pdo);
        $qrToken = generate_qr_token();

        $insert = $pdo->prepare(
            "INSERT INTO peserta
                (id, fullname, email, phone, country, company, jobtitle, segment, segment_other,
                 industry, industry_other, experience, goals, access_needs,
                 marketing_consent, thirdparty_consent, terms_accepted, qr_token, kehadiran, days)
             VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?)"
        );
        $insert->execute([
            $id,
            $fullname,
            $email,
            $phone,
            $country,
            $company,
            $jobtitle,
            $segment,
            $segmentOther ?: null,
            $industry ?: null,
            $industryOther ?: null,
            $experience,
            implode(',', $goals),
            $access ?: null,
            $marketing ? 1 : 0,
            $thirdparty ? 1 : 0,
            $terms ? 1 : 0,
            $qrToken,
            implode(',', $days),
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        throw $e;
    }

    $stmt = $pdo->prepare("SELECT * FROM peserta WHERE id = ?");
    $stmt->execute([$id]);
    json_response(['participant' => participant_json($pdo, $stmt->fetch())], 201);
}

function handle_list_participants(PDO $pdo): void
{
    require_auth();
    $rows = $pdo->query("SELECT * FROM peserta ORDER BY fullname ASC")->fetchAll();
    $ck = load_checkins($pdo);
    json_response(array_map(fn($r) => map_participant($r, $ck[$r['id']] ?? []), $rows));
}

function handle_search_participants(PDO $pdo): void
{
    require_auth();
    $q = trim($_GET['q'] ?? '');
    if ($q === '') {
        json_response([]);
    }
    $like = '%' . $q . '%';
    $stmt = $pdo->prepare(
        "SELECT * FROM peserta WHERE fullname LIKE ? OR email LIKE ? OR id LIKE ? ORDER BY fullname ASC"
    );
    $stmt->execute([$like, $like, $like]);
    $rows = $stmt->fetchAll();
    $ck = load_checkins($pdo, array_column($rows, 'id'));
    json_response(array_map(fn($r) => map_participant($r, $ck[$r['id']] ?? []), $rows));
}

function handle_checkin(PDO $pdo): void
{
    $staff = require_auth();
    $body = read_json_body();
    $qrToken = trim($body['qrToken'] ?? '');
    $day = (int) ($body['day'] ?? 0);

    if (!$qrToken)
        json_error('qrToken is required.', 422);
    if (!in_array($day, EVENT_DAYS, true))
        json_error('A valid day (1-3) is required.', 422);

    $stmt = $pdo->prepare("SELECT * FROM peserta WHERE qr_token = ?");
    $stmt->execute([$qrToken]);
    $row = $stmt->fetch();
    if (!$row)
        json_error('QR token not found.', 404);

    // Only days the participant registered for can be checked in.
    if (!in_array($day, normalize_days($row['days'] ?? ''), true)) {
        json_response([
            'error' => "Not registered for Day $day.",
            'participant' => participant_json($pdo, $row),
        ], 403);
    }

    try {
        $ins = $pdo->prepare("INSERT INTO checkin_day (peserta_id, day, waktu_checkin, checkin_oleh) VALUES (?, ?, NOW(), ?)");
        $ins->execute([$row['id'], $day, $staff['nama']]); // staff name comes from the session, not the client
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') { // unique (peserta_id, day) -> already checked in that day
            json_response([
                'error' => "Already checked in for Day $day.",
                'participant' => participant_json($pdo, $row),
            ], 409);
        }
        throw $e;
    }

    json_response(['participant' => participant_json($pdo, $row)]);
}

function handle_get_settings(PDO $pdo): void
{
    require_auth();
    $s = evaluate_registration_status($pdo);
    json_response([
        'deadline' => $s['deadline'],
        'days' => array_map(fn($d) => ['day' => $d['day'], 'quota' => $d['quota'], 'taken' => $d['taken']], $s['days']),
    ]);
}

function handle_save_settings(PDO $pdo): void
{
    require_auth();
    $body = read_json_body();
    $deadline = !empty($body['deadline']) ? $body['deadline'] : null;
    $quotas = is_array($body['quotas'] ?? null) ? $body['quotas'] : [];

    $pdo->beginTransaction();
    try {
        $up = $pdo->prepare("INSERT INTO day_settings (day, quota) VALUES (?, ?) ON DUPLICATE KEY UPDATE quota = VALUES(quota)");
        foreach (EVENT_DAYS as $d) {
            if (!array_key_exists((string) $d, $quotas))
                continue;
            $q = $quotas[(string) $d];
            $up->execute([$d, ($q === null || $q === '') ? null : max(0, (int) $q)]);
        }
        $pdo->prepare("UPDATE registration_settings SET deadline = ?, updated_at = NOW() WHERE id = 1")->execute([$deadline]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        throw $e;
    }
    handle_get_settings($pdo);
}

/** Committee changes which days a participant attends. */
function handle_update_days(PDO $pdo): void
{
    require_auth();
    $body = read_json_body();
    $id = trim($body['id'] ?? '');
    $days = normalize_days($body['days'] ?? []);
    if ($id === '' || !$days)
        json_error('id and at least one day are required.', 422);

    $pdo->beginTransaction();
    try {
        $pdo->query("SELECT day FROM day_settings FOR UPDATE")->fetchAll();
        $st = $pdo->prepare("SELECT * FROM peserta WHERE id = ? FOR UPDATE");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            $pdo->rollBack();
            json_error('Participant not found.', 404);
        }

        $old = normalize_days($row['days'] ?? '');
        $ck = load_checkins($pdo, [$id])[$id] ?? [];
        $blocked = array_values(array_diff(array_keys($ck), $days));
        if ($blocked) {
            $pdo->rollBack();
            json_error('Cannot remove Day ' . implode(', Day ', $blocked) . ': participant already checked in.', 409);
        }
        $quotas = day_quotas($pdo);
        foreach (array_diff($days, $old) as $d) {
            if ($quotas[$d] !== null && day_taken($pdo, $d) >= $quotas[$d]) {
                $pdo->rollBack();
                json_error("Quota is full for Day $d.", 409);
            }
        }
        if ($days !== $old) {
            // printed_at reset: the nametag needs reprinting when the days change.
            $pdo->prepare("UPDATE peserta SET days = ?, printed_at = NULL WHERE id = ?")->execute([implode(',', $days), $id]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        throw $e;
    }
    $st = $pdo->prepare("SELECT * FROM peserta WHERE id = ?");
    $st->execute([$id]);
    json_response(['participant' => participant_json($pdo, $st->fetch())]);
}

/** Feed for the TV welcome screen: latest check-ins (name, company, job title only). */
function handle_display_latest(PDO $pdo): void
{
    if (!hash_equals(DISPLAY_KEY, (string) ($_GET['key'] ?? ''))) {
        json_error('Forbidden.', 403);
    }
    $sel = "SELECT c.id, c.day, c.waktu_checkin, p.fullname, p.company, p.jobtitle
            FROM checkin_day c JOIN peserta p ON p.id = c.peserta_id";
    $fmt = fn($r) => [
        'id' => (int) $r['id'],
        'day' => (int) $r['day'],
        'time' => str_replace(' ', 'T', $r['waktu_checkin']),
        'name' => $r['fullname'],
        'company' => $r['company'],
        'jobtitle' => $r['jobtitle'],
    ];
    $recent = array_map($fmt, $pdo->query("$sel ORDER BY c.id DESC LIMIT 6")->fetchAll());

    // First call (no "since"): just tell the screen where we are, so old check-ins are not replayed.
    if (!isset($_GET['since'])) {
        $max = (int) $pdo->query("SELECT COALESCE(MAX(id), 0) FROM checkin_day")->fetchColumn();
        json_response(['lastId' => $max, 'items' => [], 'recent' => $recent]);
    }
    $since = (int) $_GET['since'];
    $st = $pdo->prepare("$sel WHERE c.id > ? ORDER BY c.id ASC LIMIT 20");
    $st->execute([$since]);
    $items = array_map($fmt, $st->fetchAll());
    json_response([
        'lastId' => $items ? end($items)['id'] : $since,
        'items' => $items,
        'recent' => $recent,
    ]);
}