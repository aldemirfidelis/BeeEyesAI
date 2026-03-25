<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (!$body || empty($body['userId']) || empty($body['type']) || empty($body['title']) || empty($body['description'])) {
    bad_request('userId, type, title e description são obrigatórios');
  }

  $stmt = $pdo->prepare('INSERT INTO achievements (id, user_id, type, title, description) VALUES (UUID(), ?, ?, ?, ?)');
  $stmt->execute([$body['userId'], $body['type'], $body['title'], $body['description']]);

  $stmt = $pdo->prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC LIMIT 1');
  $stmt->execute([$body['userId']]);
  $row = $stmt->fetch();
  json($row, 201);
}

if ($method === 'GET') {
  if (!empty($_GET['id'])) {
    $stmt = $pdo->prepare('SELECT * FROM achievements WHERE id = ? LIMIT 1');
    $stmt->execute([$_GET['id']]);
    $row = $stmt->fetch();
    if (!$row) bad_request('não encontrado', 404);
    json($row);
  }
  if (!empty($_GET['userId'])) {
    $stmt = $pdo->prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC');
    $stmt->execute([$_GET['userId']]);
    $rows = $stmt->fetchAll();
    json($rows);
  }
  bad_request('informe id ou userId');
}

bad_request('método não suportado', 405);
?>

