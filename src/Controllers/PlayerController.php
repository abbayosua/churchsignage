<?php

namespace ChurchSignage\Controllers;

use ChurchSignage\Database;
use ChurchSignage\Helpers;

class PlayerController
{
    public static function getPlaylist(array $params): void
    {
        $db = Database::getInstance();
        $code = $params['code'] ?? '';

        if (!$code) {
            Helpers::error('Device code required');
            return;
        }

        $stmt = $db->prepare('SELECT * FROM devices WHERE code = ?');
        $stmt->execute([$code]);
        $device = $stmt->fetch();

        if (!$device) {
            Helpers::error('Device not found', 404);
            return;
        }

        $dayName = strtolower(date('D'));

        $stmt = $db->prepare(
            "SELECT p.* FROM playlists p
             JOIN playlist_device pd ON pd.playlist_id = p.id
             WHERE p.status = 'active'
             AND (p.start_date IS NULL OR p.start_date <= CURDATE())
             AND (p.end_date IS NULL OR p.end_date >= CURDATE())
             AND p.$dayName = 1
             AND pd.is_active = 1
             AND (pd.device_id = ? OR pd.device_id IS NULL)
             AND pd.is_active = 1
             ORDER BY pd.priority DESC
             LIMIT 1"
        );
        $stmt->execute([$device['id']]);
        $playlist = $stmt->fetch();

        if (!$playlist) {
            Helpers::success([
                'playlist' => null,
                'device' => self::formatDevice($device),
                'items' => [],
            ], 'No active playlist');
            return;
        }

        $stmt = $db->prepare(
            'SELECT pi.*, m.name as media_name, m.type as media_type, m.mime, m.filename,
                    m.width, m.height, m.duration as media_duration,
                    m.size as media_size
             FROM playlist_items pi
             JOIN media m ON m.id = pi.media_id
             WHERE pi.playlist_id = ?
             ORDER BY pi.sort_order ASC'
        );
        $stmt->execute([$playlist['id']]);
        $items = $stmt->fetchAll();

        foreach ($items as &$item) {
            $item['url'] = Helpers::getUploadsUrl() . '/' . self::typeFolder($item['media_type']) . '/' . $item['filename'];
        }

        Helpers::success([
            'playlist' => $playlist,
            'device' => self::formatDevice($device),
            'items' => $items,
        ]);
    }

    public static function heartbeat(array $params): void
    {
        $code = $params['code'] ?? '';
        if (!$code) {
            Helpers::error('Device code required');
            return;
        }

        $db = Database::getInstance();
        $stmt = $db->prepare('UPDATE devices SET last_heartbeat = NOW(), ip = ? WHERE code = ?');
        $stmt->execute([$_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', $code]);

        if ($stmt->rowCount() === 0) {
            Helpers::error('Device not found', 404);
            return;
        }

        $stmt = $db->prepare('SELECT * FROM devices WHERE code = ?');
        $stmt->execute([$code]);
        $device = $stmt->fetch();

        Helpers::success([
            'heartbeat_interval' => 30,
            'device' => self::formatDevice($device),
        ]);
    }

    private static function formatDevice(array $device): array
    {
        return [
            'id' => $device['id'],
            'name' => $device['name'],
            'code' => $device['code'],
            'orientation' => $device['orientation'],
            'resolution' => $device['resolution'],
            'volume' => (int)$device['volume'],
            'settings' => $device['settings'] ? json_decode($device['settings'], true) : null,
        ];
    }

    private static function typeFolder(string $type): string
    {
        return $type === 'gif' ? 'gifs' : $type . 's';
    }
}
