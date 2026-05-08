<?php

namespace ChurchSignage\Controllers;

use ChurchSignage\Database;
use ChurchSignage\Helpers;

class MediaController
{
    private const ALLOWED_TYPES = [
        'image/jpeg' => 'image',
        'image/png' => 'image',
        'image/webp' => 'image',
        'image/bmp' => 'image',
        'image/svg+xml' => 'image',
        'image/gif' => 'gif',
        'video/mp4' => 'video',
        'video/webm' => 'video',
        'video/ogg' => 'video',
        'video/avi' => 'video',
        'video/quicktime' => 'video',
        'video/x-matroska' => 'video',
    ];

    public static function index(): void
    {
        $db = Database::getInstance();

        $page = max(1, intval($_GET['page'] ?? 1));
        $perPage = min(100, max(1, intval($_GET['per_page'] ?? 20)));
        $type = $_GET['type'] ?? '';
        $search = $_GET['search'] ?? '';

        $where = [];
        $params = [];

        if ($type && in_array($type, ['image', 'video', 'gif'])) {
            $where[] = 'type = ?';
            $params[] = $type;
        }
        if ($search) {
            $where[] = '(name LIKE ? OR original_name LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $countStmt = $db->prepare("SELECT COUNT(*) as total FROM media $whereClause");
        $countStmt->execute($params);
        $total = $countStmt->fetch()['total'];

        $offset = ($page - 1) * $perPage;
        $stmt = $db->prepare("SELECT * FROM media $whereClause ORDER BY created_at DESC LIMIT $perPage OFFSET $offset");
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        foreach ($items as &$item) {
            $item['url'] = Helpers::getUploadsUrl() . '/' . self::typeFolder($item['type']) . '/' . $item['filename'];
            if ($item['thumbnail']) {
                $item['thumbnail_url'] = Helpers::getUploadsUrl() . '/thumbnails/' . $item['thumbnail'];
            }
        }

        Helpers::success([
            'items' => $items,
            'total' => (int)$total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => ceil($total / $perPage),
        ]);
    }

    public static function show(array $params): void
    {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
        $stmt->execute([$params['id']]);
        $item = $stmt->fetch();

        if (!$item) {
            Helpers::error('Media not found', 404);
            return;
        }

        $item['url'] = Helpers::getUploadsUrl() . '/' . self::typeFolder($item['type']) . '/' . $item['filename'];
        if ($item['thumbnail']) {
            $item['thumbnail_url'] = Helpers::getUploadsUrl() . '/thumbnails/' . $item['thumbnail'];
        }

        Helpers::success($item);
    }

    public static function upload(): void
    {
        if (!isset($_FILES['file'])) {
            Helpers::error('No file uploaded');
            return;
        }

        $file = $_FILES['file'];
        $name = trim($_POST['name'] ?? '');
        $categoryId = !empty($_POST['category_id']) ? intval($_POST['category_id']) : null;

        if ($file['error'] !== UPLOAD_ERR_OK) {
            Helpers::error('Upload failed with error code: ' . $file['error']);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!isset(self::ALLOWED_TYPES[$mime])) {
            Helpers::error('File type not allowed: ' . $mime);
            return;
        }

        $type = self::ALLOWED_TYPES[$mime];
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid() . '_' . time() . '.' . $ext;
        $typeFolder = self::typeFolder($type);
        $destDir = __DIR__ . '/../../uploads/' . $typeFolder;

        if (!is_dir($destDir)) {
            mkdir($destDir, 0755, true);
        }

        $destPath = $destDir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            Helpers::error('Failed to save file', 500);
            return;
        }

        $width = null;
        $height = null;
        $duration = null;
        $thumbnail = null;

        if ($type === 'image' || $type === 'gif') {
            $imgInfo = @getimagesize($destPath);
            if ($imgInfo) {
                $width = $imgInfo[0];
                $height = $imgInfo[1];
            }
        } elseif ($type === 'video') {
            $ffprobe = self::findFfprobe();
            if ($ffprobe) {
                $cmd = sprintf(
                    '%s -v error -select_streams v:0 -show_entries stream=width,height,duration -of json %s',
                    escapeshellcmd($ffprobe),
                    escapeshellarg($destPath)
                );
                $output = shell_exec($cmd);
                if ($output) {
                    $info = json_decode($output, true);
                    if ($info && isset($info['streams'][0])) {
                        $stream = $info['streams'][0];
                        $width = $stream['width'] ?? null;
                        $height = $stream['height'] ?? null;
                        $duration = $stream['duration'] ?? null;
                    }
                }
            }
        }

        $db = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO media (name, filename, original_name, type, mime, size, width, height, duration, thumbnail, category_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $name ?: pathinfo($file['name'], PATHINFO_FILENAME),
            $filename,
            $file['name'],
            $type,
            $mime,
            $file['size'],
            $width,
            $height,
            $duration,
            $thumbnail,
            $categoryId,
        ]);

        $id = $db->lastInsertId();
        $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        $item['url'] = Helpers::getUploadsUrl() . '/' . self::typeFolder($item['type']) . '/' . $item['filename'];

        Helpers::success($item, 'File uploaded', 201);
    }

    public static function update(array $params): void
    {
        $db = Database::getInstance();
        $data = Helpers::getJsonBody();

        $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
        $stmt->execute([$params['id']]);
        $item = $stmt->fetch();

        if (!$item) {
            Helpers::error('Media not found', 404);
            return;
        }

        $fields = [];
        $values = [];
        foreach (['name', 'category_id'] as $field) {
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $values[] = $data[$field];
            }
        }

        if (empty($fields)) {
            Helpers::error('Nothing to update');
            return;
        }

        $values[] = $params['id'];
        $db->prepare('UPDATE media SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

        $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
        $stmt->execute([$params['id']]);
        $updated = $stmt->fetch();
        $updated['url'] = Helpers::getUploadsUrl() . '/' . self::typeFolder($updated['type']) . '/' . $updated['filename'];

        Helpers::success($updated, 'Updated');
    }

    public static function destroy(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM media WHERE id = ?');
        $stmt->execute([$params['id']]);
        $item = $stmt->fetch();

        if (!$item) {
            Helpers::error('Media not found', 404);
            return;
        }

        $filePath = __DIR__ . '/../../uploads/' . self::typeFolder($item['type']) . '/' . $item['filename'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        if ($item['thumbnail']) {
            $thumbPath = __DIR__ . '/../../uploads/thumbnails/' . $item['thumbnail'];
            if (file_exists($thumbPath)) {
                unlink($thumbPath);
            }
        }

        $db->prepare('DELETE FROM media WHERE id = ?')->execute([$params['id']]);
        Helpers::success(null, 'Deleted');
    }

    public static function categories(): void
    {
        $db = Database::getInstance();
        $stmt = $db->query('SELECT * FROM media_categories ORDER BY name');
        Helpers::success($stmt->fetchAll());
    }

    private static function typeFolder(string $type): string
    {
        return $type === 'gif' ? 'gifs' : $type . 's';
    }

    private static function findFfprobe(): ?string
    {
        $paths = ['ffprobe', 'ffprobe.exe', 'C:\\ffmpeg\\bin\\ffprobe.exe'];
        foreach ($paths as $p) {
            $result = trim(shell_exec("where $p 2>nul") ?: '');
            if ($result) return $result;
        }
        return null;
    }
}
