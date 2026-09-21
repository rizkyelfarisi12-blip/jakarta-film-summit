<?php


const ALLOW_MULTIPLE = true; // ganti true kalau mau tambah admin lagi

require __DIR__ . '/config.php';

$error = null;
$success = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nama = trim($_POST['nama'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = (string)($_POST['password'] ?? '');

    try {
        $pdo = db();

        $existingCount = (int)$pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn();
        if ($existingCount > 0 && !ALLOW_MULTIPLE) {
            $error = "Sudah ada admin terdaftar ($existingCount akun). Untuk keamanan, form ini tidak bisa dipakai lagi selama ALLOW_MULTIPLE = false. Kalau memang perlu, ubah ALLOW_MULTIPLE jadi true di file ini, atau buat lewat panel admin nanti.";
        } elseif (!$nama || !$email || !$password) {
            $error = "Semua field wajib diisi.";
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = "Format email tidak valid.";
        } elseif (strlen($password) < 8) {
            $error = "Password minimal 8 karakter.";
        } else {
            $check = $pdo->prepare("SELECT id FROM admin_users WHERE email = ?");
            $check->execute([$email]);
            if ($check->fetch()) {
                $error = "Sudah ada admin dengan email itu.";
            } else {
                $hash = password_hash($password, PASSWORD_BCRYPT);
                $insert = $pdo->prepare("INSERT INTO admin_users (nama, email, password_hash) VALUES (?, ?, ?)");
                $insert->execute([$nama, $email, $hash]);
                $success = "Akun admin berhasil dibuat untuk $email. Sekarang HAPUS file create-admin-web.php ini dari server, lalu login di admin-panel.html.";
            }
        }
    } catch (Throwable $e) {
        $error = "Gagal terhubung ke database. Cek DB_HOST / DB_NAME / DB_USER / DB_PASS di config.php. (" . $e->getMessage() . ")";
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Buat Akun Admin — JFS</title>
<meta name="robots" content="noindex, nofollow" />
<style>
  body { font-family: -apple-system, sans-serif; background:#F8F1E0; color:#231F20; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; }
  .card { background:#fff; border:1px solid #E6D9BC; border-radius:14px; padding:28px; width:100%; max-width:380px; }
  h1 { font-size:18px; margin:0 0 6px; }
  p.note { font-size:12.5px; color:#7A7168; margin:0 0 20px; }
  label { display:block; font-size:13px; color:#7A7168; margin-bottom:6px; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; margin-bottom:14px; border:1px solid #E6D9BC; border-radius:8px; font-size:14px; }
  button { width:100%; background:#FF6A14; color:#fff; border:none; border-radius:8px; padding:12px; font-size:14px; font-weight:700; cursor:pointer; }
  .msg { border-radius:8px; padding:12px 14px; font-size:13px; margin-bottom:16px; }
  .msg.error { background:rgba(255,106,20,0.14); color:#B34A00; }
  .msg.success { background:rgba(89,178,146,0.16); color:#2F7A5D; }
</style>
</head>
<body>
  <div class="card">
    <h1>Buat Akun Admin</h1>
    <p class="note">⚠️ Setelah berhasil, hapus file ini dari server.</p>

    <?php if ($error): ?>
      <div class="msg error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>
    <?php if ($success): ?>
      <div class="msg success"><?= htmlspecialchars($success) ?></div>
    <?php endif; ?>

    <?php if (!$success): ?>
    <form method="POST">
      <label>Nama Staff</label>
      <input type="text" name="nama" value="<?= htmlspecialchars($_POST['nama'] ?? '') ?>" required />

      <label>Email</label>
      <input type="email" name="email" value="<?= htmlspecialchars($_POST['email'] ?? '') ?>" required />

      <label>Password (min. 8 karakter)</label>
      <input type="password" name="password" required minlength="8" />

      <button type="submit">Buat Admin</button>
    </form>
    <?php endif; ?>
  </div>
</body>
</html>
