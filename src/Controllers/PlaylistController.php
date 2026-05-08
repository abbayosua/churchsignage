<?php

namespace ChurchSignage\Controllers;

use ChurchSignage\Database;
use ChurchSignage\Helpers;

class PlaylistController
{
    public static function index(): void
    {
        $db = Database::getInstance();
        $stmt = $db->query('SELECT p.*, (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as item_count FROM playlists p ORDER BY p.created_at DESC');
        $playlists = $stmt->fetchAll();

        foreach ($playlists as &$p) {
            $p['item_count'] = (int)$p['item_count'];
        }

        Helpers::success($playlists);
    }

    public static function show(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM playlists WHERE id = ?');
        $stmt->execute([$params['id']]);
        $playlist = $stmt->fetch();

        if (!$playlist) {
            Helpers::error('Playlist not found', 404);
            return;
        }

        $stmt = $db->prepare(
            'SELECT pi.*, m.name as media_name, m.type as media_type, m.mime, m.filename,
                    m.width, m.height, m.duration as media_duration
             FROM playlist_items pi
             JOIN media m ON m.id = pi.media_id
             WHERE pi.playlist_id = ?
             ORDER BY pi.sort_order ASC'
        );
        $stmt->execute([$params['id']]);
        $items = $stmt->fetchAll();

        foreach ($items as &$item) {
            $item['url'] = Helpers::getUploadsUrl() . '/' . self::typeFolder($item['media_type']) . '/' . $item['filename'];
        }

        $stmt = $db->prepare(
            'SELECT pd.*, d.name as device_name, d.code as device_code
             FROM playlist_device pd
             LEFT JOIN devices d ON d.id = pd.device_id
             WHERE pd.playlist_id = ?'
        );
        $stmt->execute([$params['id']]);
        $assignments = $stmt->fetchAll();

        $playlist['items'] = $items;
        $playlist['assignments'] = $assignments;

        Helpers::success($playlist);
    }

    public static function store(): void
    {
        $db = Database::getInstance();
        $data = Helpers::getJsonBody();

        $name = trim($data['name'] ?? '');
        if (!$name) {
            Helpers::error('Name is required');
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO playlists (name, default_duration, transition, transition_duration, bg_color, status)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $name,
            $data['default_duration'] ?? 10,
            $data['transition'] ?? 'fade',
            $data['transition_duration'] ?? 500,
            $data['bg_color'] ?? '#000000',
            $data['status'] ?? 'draft',
        ]);

        $id = $db->lastInsertId();
        $stmt = $db->prepare('SELECT * FROM playlists WHERE id = ?');
        $stmt->execute([$id]);
        Helpers::success($stmt->fetch(), 'Playlist created', 201);
    }

    public static function update(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM playlists WHERE id = ?');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) {
            Helpers::error('Playlist not found', 404);
            return;
        }

        $data = Helpers::getJsonBody();
        $allowed = ['name', 'default_duration', 'transition', 'transition_duration', 'bg_color', 'status', 'start_date', 'end_date'];
        $dayFields = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        $fields = [];
        $values = [];
        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $values[] = $data[$field];
            }
        }
        foreach ($dayFields as $field) {
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $values[] = $data[$field] ? 1 : 0;
            }
        }

        if (empty($fields)) {
            Helpers::error('Nothing to update');
            return;
        }

        $values[] = $params['id'];
        $db->prepare('UPDATE playlists SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

        $stmt = $db->prepare('SELECT * FROM playlists WHERE id = ?');
        $stmt->execute([$params['id']]);
        Helpers::success($stmt->fetch(), 'Updated');
    }

    public static function destroy(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM playlists WHERE id = ?');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) {
            Helpers::error('Playlist not found', 404);
            return;
        }

        $db->prepare('DELETE FROM playlists WHERE id = ?')->execute([$params['id']]);
        Helpers::success(null, 'Deleted');
    }

    public static function saveItems(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM playlists WHERE id = ?');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) {
            Helpers::error('Playlist not found', 404);
            return;
        }

        $data = Helpers::getJsonBody();
        $items = $data['items'] ?? [];

        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM playlist_items WHERE playlist_id = ?')->execute([$params['id']]);

            $insertStmt = $db->prepare(
                'INSERT INTO playlist_items (playlist_id, media_id, sort_order, duration_override, transition)
                 VALUES (?, ?, ?, ?, ?)'
            );

            foreach ($items as $sortOrder => $item) {
                $insertStmt->execute([
                    $params['id'],
                    $item['media_id'],
                    $sortOrder,
                    $item['duration_override'] ?? null,
                    $item['transition'] ?? null,
                ]);
            }

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            Helpers::error('Failed to save items: ' . $e->getMessage(), 500);
            return;
        }

        Helpers::success(null, 'Items saved');
    }

    public static function assign(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM playlists WHERE id = ?');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) {
            Helpers::error('Playlist not found', 404);
            return;
        }

        $data = Helpers::getJsonBody();
        $deviceIds = $data['device_ids'] ?? [];
        $groupId = $data['group_id'] ?? null;
        $isAll = $data['all_devices'] ?? false;

        if ($isAll) {
            $db->prepare('DELETE FROM playlist_device WHERE playlist_id = ?')->execute([$params['id']]);
            $db->prepare('INSERT INTO playlist_device (playlist_id, device_id, group_id, priority) VALUES (?, NULL, NULL, 0)')
                ->execute([$params['id']]);
        } elseif ($groupId) {
            $db->prepare('DELETE FROM playlist_device WHERE playlist_id = ?')->execute([$params['id']]);
            $db->prepare('INSERT INTO playlist_device (playlist_id, group_id, priority) VALUES (?, ?, 0)')
                ->execute([$params['id'], $groupId]);
        } elseif (!empty($deviceIds)) {
            $db->prepare('DELETE FROM playlist_device WHERE playlist_id = ?')->execute([$params['id']]);
            $insertStmt = $db->prepare('INSERT INTO playlist_device (playlist_id, device_id, priority) VALUES (?, ?, 0)');
            foreach ($deviceIds as $did) {
                $insertStmt->execute([$params['id'], $did]);
            }
        } else {
            Helpers::error('Specify device_ids, group_id, or all_devices');
            return;
        }

        Helpers::success(null, 'Playlist assigned');
    }

    private static function typeFolder(string $type): string
    {
        return $type === 'gif' ? 'gifs' : $type . 's';
    }
}
