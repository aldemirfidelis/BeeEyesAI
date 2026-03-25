<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (!$body || empty($body['userId']) || !isset($body['mood'])) {
    bad_request('userId e mood são obrigatórios');
  }
  $note = isset($body['note']) ? $body['note'] : null;

  $stmt = $pdo->prepare('INSERT INTO mood_entries (id, user_id, mood, note) VALUES (UUID(), ?, ?, ?)');
  $stmt->execute([$body['userId'], intval($body['mood']), $note]);

  $stmt = $pdo->prepare('SELECT * FROM mood_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
  $stmt->execute([$body['userId']]);
  $entry = $stmt->fetch();
  json($entry, 201);
}

if ($method === 'GET') {
  if (!empty($_GET['id'])) {
    $stmt = $pdo->prepare('SELECT * FROM mood_entries WHERE id = ? LIMIT 1');
    $stmt->execute([$_GET['id']]);
    $entry = $stmt->fetch();
    if (!$entry) bad_request('não encontrado', 404);
    json($entry);
  }
  if (!empty($_GET['userId'])) {
    $stmt = $pdo->prepare('SELECT * FROM mood_entries WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$_GET['userId']]);
    $rows = $stmt->fetchAll();
    json($rows);
  }
  bad_request('informe id ou userId');
}

bad_request('método não suportado', 405);
?>

