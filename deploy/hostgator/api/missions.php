<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();

if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  if (!$body || empty($body['userId']) || empty($body['title'])) {
    bad_request('userId e title são obrigatórios');
  }
  $description = isset($body['description']) ? $body['description'] : null;
  $xpReward = isset($body['xpReward']) ? intval($body['xpReward']) : 10;

  $stmt = $pdo->prepare('INSERT INTO missions (id, user_id, title, description, completed, xp_reward) VALUES (UUID(), ?, ?, ?, 0, ?)');
  $stmt->execute([$body['userId'], $body['title'], $description, $xpReward]);

  $stmt = $pdo->prepare('SELECT * FROM missions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1');
  $stmt->execute([$body['userId']]);
  $mission = $stmt->fetch();
  json($mission, 201);
}

if ($method === 'GET') {
  if (!empty($_GET['id'])) {
    $stmt = $pdo->prepare('SELECT * FROM missions WHERE id = ? LIMIT 1');
    $stmt->execute([$_GET['id']]);
    $mission = $stmt->fetch();
    if (!$mission) bad_request('não encontrado', 404);
    json($mission);
  }
  if (!empty($_GET['userId'])) {
    $sql = 'SELECT * FROM missions WHERE user_id = ?';
    $params = [$_GET['userId']];
    if (isset($_GET['completed'])) {
      $sql .= ' AND completed = ?';
      $params[] = ($_GET['completed'] == '1' || strtolower($_GET['completed']) === 'true') ? 1 : 0;
    }
    $sql .= ' ORDER BY created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    json($rows);
  }
  bad_request('informe id ou userId');
}

// marca missão como concluída (PUT com JSON { completed: true })
if ($method === 'PUT') {
  parse_str($_SERVER['QUERY_STRING'] ?? '', $qs);
  if (empty($qs['id'])) { bad_request('id é obrigatório'); }
  $body = json_decode(file_get_contents('php://input'), true) ?: [];
  $completed = !empty($body['completed']);
  if ($completed) {
    $stmt = $pdo->prepare('UPDATE missions SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?');
  } else {
    $stmt = $pdo->prepare('UPDATE missions SET completed = 0, completed_at = NULL WHERE id = ?');
  }
  $stmt->execute([$qs['id']]);
  $stmt = $pdo->prepare('SELECT * FROM missions WHERE id = ? LIMIT 1');
  $stmt->execute([$qs['id']]);
  $mission = $stmt->fetch();
  if (!$mission) bad_request('não encontrado', 404);
  json($mission);
}

bad_request('método não suportado', 405);
?>

