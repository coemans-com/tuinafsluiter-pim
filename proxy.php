<?php
// proxy.php - Handles Teamleader OAuth and API requests via cURL
// Place this file in the public root of your Combell hosting

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, x-client-info, apikey");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Handle Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Parse Input
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (!$input) {
    echo json_encode(['error' => 'Invalid JSON body', 'raw' => $inputJSON]);
    exit();
}

$action = $input['action'] ?? '';

// Helper function for cURL
function makeCurlRequest($url, $method, $headers, $body) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // Combell has valid certs
    
    // Prepare headers
    $curlHeaders = [];
    foreach ($headers as $key => $value) {
        $curlHeaders[] = "$key: $value";
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

    if ($body) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['error' => "cURL Error: $curlError", 'upstreamStatus' => 500];
    }

    // Attempt to decode JSON response from upstream
    $decoded = json_decode($response, true);
    $data = $decoded ? $decoded : $response;

    // Check for HTTP errors
    if ($httpCode >= 400) {
        return ['error' => $data, 'upstreamStatus' => $httpCode];
    }

    return $data;
}

// --- ACTION 1: EXCHANGE ---
if ($action === 'exchange') {
    $tokenUrl = 'https://focus.teamleader.eu/oauth2/access_token';
    
    // Authorization Code Grant
    $params = [
        'client_id' => $input['client_id'],
        'client_secret' => $input['client_secret'],
        'code' => $input['code'],
        'grant_type' => 'authorization_code',
        'redirect_uri' => $input['redirect_uri']
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenUrl);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params)); // Form URL Encoded
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Return raw response (Teamleader returns JSON)
    echo $response; 
    exit();
}

// --- ACTION 2: REFRESH ---
if ($action === 'refresh') {
    $tokenUrl = 'https://focus.teamleader.eu/oauth2/access_token';
    
    // Refresh Token Grant
    $params = [
        'client_id' => $input['client_id'],
        'client_secret' => $input['client_secret'],
        'refresh_token' => $input['refresh_token'],
        'grant_type' => 'refresh_token'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenUrl);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    echo $response;
    exit();
}

// --- ACTION 3: REQUEST (PROXY) ---
if ($action === 'request' || !$action) {
    $url = $input['url'] ?? '';
    
    // Security Whitelist
    if (strpos($url, 'teamleader.eu') === false) {
        echo json_encode(['error' => 'Only Teamleader URLs allowed', 'upstreamStatus' => 403]);
        exit();
    }

    $method = $input['method'] ?? 'GET';
    $headers = $input['headers'] ?? [];
    $body = $input['body'] ?? null;

    // Execute
    $result = makeCurlRequest($url, $method, $headers, $body);
    
    echo json_encode($result);
    exit();
}

echo json_encode(['error' => 'Invalid Action']);
?>