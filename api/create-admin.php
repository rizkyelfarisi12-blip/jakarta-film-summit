<?php
/**
 * create-admin.php — run this ONCE from the command line to create a
 * staff/admin login. Never expose this file over the web; delete it
 * (or move it outside the public folder) after you're done using it.
 *
 * Usage:
 *   php create-admin.php "Nama Staff" "admin@jakartafilmsummit.com" "your-strong-password"
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("This script can only be run from the command line (php create-admin.php ...), not over the web.\n");
}

require __DIR__ . '/config.php';

[$script, $nama, $email, $password] = array_pad($argv, 4, null);

if (!$nama || !$email || !$password) {
    fwrite(STDERR, "Usage: php create-admin.php \"Full Name\" \"email@example.com\" \"password\"\n");
    exit(1);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "That doesn't look like a valid email address.\n");
    exit(1);
}
if (strlen($password) < 8) {
    fwrite(STDERR, "Password should be at least 8 characters.\n");
    exit(1);
}

$pdo = db();

$check = $pdo->prepare("SELECT id FROM admin_users WHERE email = ?");
$check->execute([$email]);
if ($check->fetch()) {
    fwrite(STDERR, "An admin with that email already exists.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_BCRYPT);

$insert = $pdo->prepare("INSERT INTO admin_users (nama, email, password_hash) VALUES (?, ?, ?)");
$insert->execute([$nama, $email, $hash]);

echo "Admin account created:\n";
echo "  Name:  $nama\n";
echo "  Email: $email\n";
echo "You can now log in at admin-panel.html with this email and password.\n";
