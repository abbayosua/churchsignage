<?php

namespace ChurchSignage\Controllers;

use ChurchSignage\Database;
use ChurchSignage\Helpers;

class AuthController
{
    public static function login(): void
    {
        $data = Helpers::getJsonBody();
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';

        if (!$username || !$password) {
            Helpers::error('Username and password required');
            return;
        }

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Helpers::error('Invalid credentials', 401);
            return;
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['display_name'] = $user['display_name'];

        Helpers::success([
            'id' => $user['id'],
            'username' => $user['username'],
            'display_name' => $user['display_name'],
        ], 'Login successful');
    }

    public static function logout(): void
    {
        $_SESSION = [];
        session_destroy();
        Helpers::success(null, 'Logged out');
    }

    public static function check(): void
    {
        if (isset($_SESSION['user_id'])) {
            Helpers::success([
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'display_name' => $_SESSION['display_name'],
            ]);
        } else {
            Helpers::error('Not authenticated', 401);
        }
    }

    public static function setup(): void
    {
        $db = Database::getInstance();

        $stmt = $db->query('SELECT COUNT(*) as cnt FROM users');
        $count = $stmt->fetch()['cnt'];

        if ($count > 0) {
            Helpers::error('Already has users', 400);
            return;
        }

        $data = Helpers::getJsonBody();
        $username = trim($data['username'] ?? 'admin');
        $password = $data['password'] ?? 'admin';
        $displayName = $data['display_name'] ?? 'Administrator';

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $db->prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)');
        $stmt->execute([$username, $hash, $displayName]);

        Helpers::success(['username' => $username, 'display_name' => $displayName], 'User created');
    }
}
