<?php

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/Helpers.php';
require_once __DIR__ . '/src/Router.php';
require_once __DIR__ . '/src/Controllers/AuthController.php';
require_once __DIR__ . '/src/Controllers/MediaController.php';
require_once __DIR__ . '/src/Controllers/PlaylistController.php';
require_once __DIR__ . '/src/Controllers/DeviceController.php';
require_once __DIR__ . '/src/Controllers/PlayerController.php';

use ChurchSignage\Router;
use ChurchSignage\Helpers;
use ChurchSignage\Controllers\AuthController;
use ChurchSignage\Controllers\MediaController;
use ChurchSignage\Controllers\PlaylistController;
use ChurchSignage\Controllers\DeviceController;
use ChurchSignage\Controllers\PlayerController;


header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (Helpers::getRequestMethod() === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_start();

$router = new Router();

$router->post('/api/auth/login', [AuthController::class, 'login']);
$router->post('/api/auth/logout', [AuthController::class, 'logout']);
$router->get('/api/auth/check', [AuthController::class, 'check']);
$router->post('/api/auth/setup', [AuthController::class, 'setup']);

$router->get('/api/media', [MediaController::class, 'index']);
$router->get('/api/media/{id}', [MediaController::class, 'show']);
$router->post('/api/media/upload', [MediaController::class, 'upload']);
$router->put('/api/media/{id}', [MediaController::class, 'update']);
$router->delete('/api/media/{id}', [MediaController::class, 'destroy']);
$router->get('/api/media-categories', [MediaController::class, 'categories']);

$router->get('/api/playlists', [PlaylistController::class, 'index']);
$router->get('/api/playlists/{id}', [PlaylistController::class, 'show']);
$router->post('/api/playlists', [PlaylistController::class, 'store']);
$router->put('/api/playlists/{id}', [PlaylistController::class, 'update']);
$router->delete('/api/playlists/{id}', [PlaylistController::class, 'destroy']);
$router->post('/api/playlists/{id}/items', [PlaylistController::class, 'saveItems']);
$router->post('/api/playlists/{id}/assign', [PlaylistController::class, 'assign']);

$router->get('/api/devices', [DeviceController::class, 'index']);
$router->get('/api/devices/{id}', [DeviceController::class, 'show']);
$router->post('/api/devices', [DeviceController::class, 'store']);
$router->put('/api/devices/{id}', [DeviceController::class, 'update']);
$router->delete('/api/devices/{id}', [DeviceController::class, 'destroy']);
$router->get('/api/device-groups', [DeviceController::class, 'groups']);

$router->get('/api/player/{code}', [PlayerController::class, 'getPlaylist']);
$router->post('/api/player/{code}/heartbeat', [PlayerController::class, 'heartbeat']);

try {
    $router->dispatch();
} catch (\Exception $e) {
    Helpers::error('Internal server error: ' . $e->getMessage(), 500);
}
