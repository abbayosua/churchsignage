<?php

namespace ChurchSignage\Controllers;

use ChurchSignage\Database;
use ChurchSignage\Helpers;

class DeviceController
{
    public static function index(): void
    {
        $db = Database::getInstance();
        $stmt = $db->query(
            'SELECT d.*, dg.name as group_name FROM devices d
             LEFT JOIN device_groups dg ON dg.id = d.group_id
             ORDER BY d.created_at DESC'
        );
        $devices = $stmt->fetchAll();

        foreach ($devices as &$device) {
            $device['is_online'] = self::isOnline($device['last_heartbeat']);
        }

        Helpers::success($devices);
    }

    public static function show(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT d.*, dg.name as group_name FROM devices d
             LEFT JOIN device_groups dg ON dg.id = d.group_id
             WHERE d.id = ?'
        );
        $stmt->execute([$params['id']]);
        $device = $stmt->fetch();

        if (!$device) {
            Helpers::error('Device not found', 404);
            return;
        }

        $device['is_online'] = self::isOnline($device['last_heartbeat']);

        $stmt = $db->prepare(
            'SELECT p.id, p.name, p.status, pd.priority
             FROM playlist_device pd
             JOIN playlists p ON p.id = pd.playlist_id
             WHERE (pd.device_id = ? OR pd.device_id IS NULL OR pd.group_id = ?)
             AND pd.is_active = 1
             ORDER BY pd.priority DESC'
        );
        $stmt->execute([$params['id'], $device['group_id']]);
        $device['playlists'] = $stmt->fetchAll();

        Helpers::success($device);
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

        $code = $data['code'] ?? self::generateCode();

        $stmt = $db->prepare(
            'INSERT INTO devices (name, code, group_id, orientation, resolution, is_active)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $name,
            $code,
            $data['group_id'] ?? null,
            $data['orientation'] ?? 'landscape',
            $data['resolution'] ?? '1920x1080',
            $data['is_active'] ?? 1,
        ]);

        $id = $db->lastInsertId();
        $stmt = $db->prepare('SELECT * FROM devices WHERE id = ?');
        $stmt->execute([$id]);
        $device = $stmt->fetch();
        $device['is_online'] = false;

        Helpers::success($device, 'Device created', 201);
    }

    public static function update(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM devices WHERE id = ?');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) {
            Helpers::error('Device not found', 404);
            return;
        }

        $data = Helpers::getJsonBody();
        $allowed = ['name', 'group_id', 'orientation', 'resolution', 'volume', 'is_active'];

        $fields = [];
        $values = [];
        foreach ($allowed as $field) {
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
        $db->prepare('UPDATE devices SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

        $stmt = $db->prepare('SELECT * FROM devices WHERE id = ?');
        $stmt->execute([$params['id']]);
        $device = $stmt->fetch();
        $device['is_online'] = self::isOnline($device['last_heartbeat']);

        Helpers::success($device, 'Updated');
    }

    public static function destroy(array $params): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM devices WHERE id = ?');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) {
            Helpers::error('Device not found', 404);
            return;
        }

        $db->prepare('DELETE FROM devices WHERE id = ?')->execute([$params['id']]);
        Helpers::success(null, 'Deleted');
    }

    public static function groups(): void
    {
        $db = Database::getInstance();
        $stmt = $db->query('SELECT * FROM device_groups ORDER BY name');
        Helpers::success($stmt->fetchAll());
    }

    private static function generateCode(): string
    {
        return strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
    }

    private static function isOnline(?string $lastHeartbeat): bool
    {
        if (!$lastHeartbeat) return false;
        $diff = time() - strtotime($lastHeartbeat);
        return $diff < 120;
    }
}
