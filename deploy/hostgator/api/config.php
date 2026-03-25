<?php
// Configuração de conexão MySQL (preencha com seus dados do cPanel)

$DB_HOST = getenv('DB_HOST') ?: 'localhost';
$DB_NAME = getenv('DB_NAME') ?: 'aldemi68_bee';
$DB_USER = getenv('DB_USER') ?: 'aldemi68_aldemir';
$DB_PASS = getenv('DB_PASS') ?: 'Aldemir123#';
$DB_CHARSET = 'utf8mb4';

function db() {
  static $pdo = null;
  if ($pdo) return $pdo;

  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS, $DB_CHARSET;
  $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset={$DB_CHARSET}";
  $opts = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ];

  $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $opts);
  return $pdo;
}

function json($data, $status=200) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data);
  exit;
}

function bad_request($msg='Bad Request', $status=400) { json([ 'message' => $msg ], $status); }

?>

