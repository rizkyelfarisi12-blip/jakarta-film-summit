<?php
/**
 * debug-login.php
 * ---------------------------------------------------------------
 * Script sementara untuk mendiagnosis kenapa login gagal.
 * Jalankan lewat CLI (BUKAN browser), lalu HAPUS setelah selesai —
 * ini menampilkan hash password mentah dari database.
 *
 * Usage:
 *   php debug-login.php "email@kamu.com" "passwordyangdicoba"
 * ---------------------------------------------------------------
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("Jalankan lewat CLI: php debug-login.php \"email\" \"password\"\n");
}

require __DIR__ . '/config.php';

[$script, $email, $password] = array_pad($argv, 3, null);

if (!$email || !$password) {
    fwrite(STDERR, "Usage: php debug-login.php \"email@kamu.com\" \"passwordnya\"\n");
    exit(1);
}

$pdo = db();

echo "=== Input ===\n";
echo "Email dicari  : [" . $email . "]  (panjang: " . strlen($email) . ")\n";
echo "Password coba : [" . $password . "]  (panjang: " . strlen($password) . ")\n\n";

$stmt = $pdo->prepare("SELECT * FROM admin_users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    echo "❌ TIDAK KETEMU baris dengan email persis itu di tabel admin_users.\n";
    echo "   Cek apakah ada spasi tersembunyi / beda huruf besar-kecil di kolom email.\n\n";
    echo "Semua email yang ada di tabel admin_users saat ini:\n";
    $all = $pdo->query("SELECT id, email, LENGTH(email) as len FROM admin_users")->fetchAll();
    foreach ($all as $row) {
        echo "  - [" . $row['email'] . "]  (panjang: " . $row['len'] . ", id: " . $row['id'] . ")\n";
    }
    exit;
}

echo "✅ Baris ketemu. id=" . $user['id'] . ", nama=" . $user['nama'] . "\n";
echo "Hash di database: " . $user['password_hash'] . "\n";
echo "Panjang hash: " . strlen($user['password_hash']) . " (harus 60 untuk bcrypt)\n\n";

$valid = password_verify($password, $user['password_hash']);
echo $valid
    ? "✅ password_verify() COCOK — password ini seharusnya BISA login.\n"
    : "❌ password_verify() TIDAK COCOK — password yang kamu ketik beda dengan yang di-hash.\n";
