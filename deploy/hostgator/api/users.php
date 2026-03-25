<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (!$body || empty($body['username']) || empty($body['password'])) {
    bad_request('username e password são obrigatórios');
  }
  $username = trim($body['username']);
  $password = password_hash($body['password'], PASSWORD_BCRYPT);

  // checa duplicidade
  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
  $stmt->execute([$username]);
  if ($stmt->fetch()) {
    bad_request('username já existe', 409);
  }

  $stmt = $pdo->prepare('INSERT INTO users (id, username, password) VALUES (UUID(), ?, ?)');
  $stmt->execute([$username, $password]);

  $id = $pdo->lastInsertId(); // pode retornar "0" em MySQL com UUID(); buscaremos pelo username
  $stmt = $pdo->prepare('SELECT id, username, level, xp, current_streak, created_at FROM users WHERE username = ? LIMIT 1');
  $stmt->execute([$username]);
  $user = $stmt->fetch();
  json($user, 201);
}

if ($method === 'GET') {
  if (!empty($_GET['id'])) {
    $stmt = $pdo->prepare('SELECT id, username, level, xp, current_streak, created_at FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$_GET['id']]);
    $user = $stmt->fetch();
    if (!$user) bad_request('não encontrado', 404);
    json($user);
  }
  if (!empty($_GET['username'])) {
    $stmt = $pdo->prepare('SELECT id, username, level, xp, current_streak, created_at FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$_GET['username']]);
    $user = $stmt->fetch();
    if (!$user) bad_request('não encontrado', 404);
    json($user);
  }
  bad_request('informe id ou username');
}

bad_request('método não suportado', 405);
?>

