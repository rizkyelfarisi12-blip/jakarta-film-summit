<?php
require __DIR__ . '/config.php';

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $nama = trim($_POST['nama'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($nama === '' || $email === '' || $password === '') {
        $error = 'Semua field wajib diisi.';
    }

    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Format email tidak valid.';
    }

    elseif (strlen($password) < 8) {
        $error = 'Password minimal 8 karakter.';
    }

    else {

        try {

            $pdo = db();

            $check = $pdo->prepare(
                "SELECT id FROM admin_users WHERE email = ?"
            );

            $check->execute([$email]);

            if ($check->fetch()) {

                $error = 'Admin dengan email tersebut sudah ada.';

            } else {

                $hash = password_hash(
                    $password,
                    PASSWORD_BCRYPT
                );

                $insert = $pdo->prepare(
                    "INSERT INTO admin_users
                    (nama, email, password_hash)
                    VALUES (?, ?, ?)"
                );

                $insert->execute([
                    $nama,
                    $email,
                    $hash
                ]);

                $message = 'Admin berhasil dibuat. Silakan login ke admin panel.';

            }

        } catch (PDOException $e) {

            $error = 'Terjadi kesalahan database.';
        }
    }
}
?>

<!DOCTYPE html>
<html lang="id">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Buat Admin — Jakarta Film Summit</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            background: #f4f4f1;
            color: #1e1e19;
        }

        .card {
            width: min(420px, calc(100% - 32px));

            background: #ffffff;

            padding: 32px;

            border-radius: 18px;

            box-shadow:
                0 20px 50px rgba(30, 30, 25, .12);
        }

        .logo {
            text-align: center;
            margin-bottom: 24px;
        }

        .logo img {
            width: 150px;
            height: auto;
        }

        h1 {
            margin: 0 0 8px;
            font-size: 1.4rem;
            text-align: center;
        }

        .subtitle {
            margin: 0 0 24px;
            text-align: center;
            color: #777;
            font-size: .9rem;
        }

        label {
            display: block;
            margin-bottom: 7px;
            font-size: .85rem;
            font-weight: 700;
        }

        input {
            width: 100%;
            padding: 12px 14px;

            border: 1px solid #d5d5d0;
            border-radius: 10px;

            font-size: .95rem;

            margin-bottom: 17px;
        }

        input:focus {
            outline: none;
            border-color: #bf4419;
        }

        button {
            width: 100%;

            border: 0;
            border-radius: 999px;

            padding: 13px 20px;

            background: #bf4419;
            color: white;

            font-size: .95rem;
            font-weight: 700;

            cursor: pointer;
        }

        button:hover {
            opacity: .9;
        }

        .message {
            padding: 12px;
            margin-bottom: 18px;

            border-radius: 10px;

            background: #e7f5e9;
            color: #236b2b;

            font-size: .9rem;
        }

        .error {
            padding: 12px;
            margin-bottom: 18px;

            border-radius: 10px;

            background: #fde8e5;
            color: #a12d20;

            font-size: .9rem;
        }

    </style>

</head>

<body>

<div class="card">

    <div class="logo">

        <img
            src="assets/icon/jfs_logo_black.png"
            alt="Jakarta Film Summit"
        >

    </div>


    <h1>Buat Akun Admin</h1>

    <p class="subtitle">
        Jakarta Film Summit — Admin Panel
    </p>


    <?php if ($message): ?>

        <div class="message">
            <?= htmlspecialchars($message) ?>
        </div>

    <?php endif; ?>


    <?php if ($error): ?>

        <div class="error">
            <?= htmlspecialchars($error) ?>
        </div>

    <?php endif; ?>


    <form method="POST">

        <label for="nama">
            Nama
        </label>

        <input
            type="text"
            id="nama"
            name="nama"
            placeholder="Nama admin"
            required
        >


        <label for="email">
            Email
        </label>

        <input
            type="email"
            id="email"
            name="email"
            placeholder="admin@jakartafilmsummit.com"
            required
        >


        <label for="password">
            Password
        </label>

        <input
            type="password"
            id="password"
            name="password"
            placeholder="Minimal 8 karakter"
            minlength="8"
            required
        >


        <button type="submit">
            Buat Admin
        </button>

    </form>

</div>

</body>

</html>