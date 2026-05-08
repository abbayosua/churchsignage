<?php

namespace ChurchSignage;

class Router
{
    private array $routes = [];

    public function get(string $path, callable $handler): void
    {
        $this->routes['GET'][$path] = $handler;
    }

    public function post(string $path, callable $handler): void
    {
        $this->routes['POST'][$path] = $handler;
    }

    public function put(string $path, callable $handler): void
    {
        $this->routes['PUT'][$path] = $handler;
    }

    public function delete(string $path, callable $handler): void
    {
        $this->routes['DELETE'][$path] = $handler;
    }

    public function resource(string $base, string $controllerClass): void
    {
        $this->get($base, [$controllerClass, 'index']);
        $this->get("$base/{id}", [$controllerClass, 'show']);
        $this->post($base, [$controllerClass, 'store']);
        $this->put("$base/{id}", [$controllerClass, 'update']);
        $this->delete("$base/{id}", [$controllerClass, 'destroy']);
    }

    public function dispatch(): void
    {
        $method = Helpers::getRequestMethod();
        $uri = self::parseUri();

        if (!isset($this->routes[$method])) {
            Helpers::error('Method not allowed', 405);
            return;
        }

        foreach ($this->routes[$method] as $pattern => $handler) {
            $regex = self::patternToRegex($pattern);
            if (preg_match($regex, $uri, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                call_user_func($handler, $params);
                return;
            }
        }

        Helpers::error('Not found', 404);
    }

    private static function parseUri(): string
    {
        $uri = $_SERVER['REQUEST_URI'];
        $uri = parse_url($uri, PHP_URL_PATH);
        $basePath = dirname($_SERVER['SCRIPT_NAME']);
        if ($basePath !== '/' && strpos($uri, $basePath) === 0) {
            $uri = substr($uri, strlen($basePath));
        }
        return '/' . trim($uri, '/');
    }

    private static function patternToRegex(string $pattern): string
    {
        $regex = preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }
}
