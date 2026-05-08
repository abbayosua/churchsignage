<?php

$host = '127.0.0.1';
$username = 'root';
$password = '';
$dbname = 'churchsignage';

try {
    $pdo = new PDO("mysql:host=$host", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbname`");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(100) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS media_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL
        ) ENGINE=InnoDB
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS media (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            type ENUM('image','video','gif') NOT NULL,
            mime VARCHAR(100) NOT NULL,
            size BIGINT NOT NULL DEFAULT 0,
            width INT DEFAULT NULL,
            height INT DEFAULT NULL,
            duration DECIMAL(10,2) DEFAULT NULL,
            thumbnail VARCHAR(255) DEFAULT NULL,
            category_id INT DEFAULT NULL,
            metadata JSON DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES media_categories(id) ON DELETE SET NULL
        ) ENGINE=InnoDB
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS playlists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            default_duration INT NOT NULL DEFAULT 10,
            transition ENUM('fade','crossfade','slide','none') DEFAULT 'fade',
            transition_duration INT DEFAULT 500,
            bg_color VARCHAR(7) DEFAULT '#000000',
            status ENUM('draft','active') DEFAULT 'draft',
            start_date DATE DEFAULT NULL,
            end_date DATE DEFAULT NULL,
            mon TINYINT(1) DEFAULT 1,
            tue TINYINT(1) DEFAULT 1,
            wed TINYINT(1) DEFAULT 1,
            thu TINYINT(1) DEFAULT 1,
            fri TINYINT(1) DEFAULT 1,
            sat TINYINT(1) DEFAULT 1,
            sun TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS playlist_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            playlist_id INT NOT NULL,
            media_id INT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            duration_override INT DEFAULT NULL,
            transition VARCHAR(20) DEFAULT NULL,
            layer INT DEFAULT 0,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS device_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL
        ) ENGINE=InnoDB
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS devices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) UNIQUE NOT NULL,
            group_id INT DEFAULT NULL,
            orientation ENUM('landscape','portrait') DEFAULT 'landscape',
            resolution VARCHAR(20) DEFAULT '1920x1080',
            last_heartbeat TIMESTAMP NULL DEFAULT NULL,
            ip VARCHAR(45) DEFAULT NULL,
            volume INT DEFAULT 100,
            api_key VARCHAR(64) DEFAULT NULL,
            settings JSON DEFAULT NULL,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE SET NULL
        ) ENGINE=InnoDB
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS playlist_device (
            id INT AUTO_INCREMENT PRIMARY KEY,
            playlist_id INT NOT NULL,
            device_id INT DEFAULT NULL,
            group_id INT DEFAULT NULL,
            priority INT DEFAULT 0,
            time_start TIME DEFAULT NULL,
            time_end TIME DEFAULT NULL,
            is_active TINYINT(1) DEFAULT 1,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
            FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    ");

    // Seed data
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM media_categories");
    if ($stmt->fetch()['cnt'] == 0) {
        $pdo->exec("INSERT INTO media_categories (name) VALUES ('General'), ('Worship'), ('Announcement'), ('Scripture'), ('Event')");
        $pdo->exec("INSERT INTO device_groups (name) VALUES ('Main Hall'), ('Lobby'), ('Youth Room'), ('Kids Room')");
    }

    // Create default admin user if none exists
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM users");
    if ($stmt->fetch()['cnt'] == 0) {
        $hash = password_hash('admin', PASSWORD_BCRYPT);
        $pdo->prepare("INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)")
            ->execute(['admin', $hash, 'Administrator']);
        echo "Default user created: admin / admin\n";
    }

    echo "\n✅ Database setup complete!\n";
    echo "   Database: $dbname\n";
    echo "   Login:    admin / admin\n";
    echo "   URL:      http://localhost/churchsignage\n";

} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
