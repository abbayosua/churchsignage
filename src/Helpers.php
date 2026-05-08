<?php

namespace ChurchSignage;

class Helpers
{
    public static function json($data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success($data = null, string $message = 'OK', int $status = 200): void
    {
        self::json([
            'success' => true,
            'data' => $data,
            'message' => $message,
        ], $status);
    }

    public static function error(string $message, int $status = 400, $errors = null): void
    {
        $res = ['success' => false, 'message' => $message];
        if ($errors !== null) {
            $res['errors'] = $errors;
        }
        self::json($res, $status);
    }

    public static function getJsonBody(): array
    {
        $body = file_get_contents('php://input');
        $data = json_decode($body, true);
        return is_array($data) ? $data : [];
    }

    public static function getRequestMethod(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD']);
    }

    public static function getBearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.+)$/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    public static function sanitizeFilename(string $name): string
    {
        $name = preg_replace('/[^\w\.\-]/u', '_', $name);
        $name = preg_replace('/_+/', '_', $name);
        return trim($name, '_');
    }

    public static function getBasePath(): string
    {
        $scriptDir = dirname($_SERVER['SCRIPT_NAME']);
        return rtrim($scriptDir, '/');
    }

    public static function getUploadsUrl(): string
    {
        return self::getBasePath() . '/uploads';
    }
}
