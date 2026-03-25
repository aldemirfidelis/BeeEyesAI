<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (!$body || empty($body['userId']) || empty($body['role']) || empty($body['content'])) {
    bad_request('userId, role e content são obrigatórios');
  }

  $stmt = $pdo->prepare('INSERT INTO messages (id, user_id, role, content) VALUES (UUID(), ?, ?, ?)');
  $stmt->execute([$body['userId'], $body['role'], $body['content']]);

  $stmt = $pdo->prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
  $stmt->execute([$body['userId']]);
  $msg = $stmt->fetch();
  json($msg, 201);
}

if ($method === 'GET') {
  if (!empty($_GET['id'])) {
    $stmt = $pdo->prepare('SELECT * FROM messages WHERE id = ? LIMIT 1');
    $stmt->execute([$_GET['id']]);
    $msg = $stmt->fetch();
    if (!$msg) bad_request('não encontrado', 404);
    json($msg);
  }
  if (!empty($_GET['userId'])) {
    $stmt = $pdo->prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$_GET['userId']]);
    $rows = $stmt->fetchAll();
    json($rows);
  }
  bad_request('informe id ou userId');
}

bad_request('método não suportado', 405);
?>

