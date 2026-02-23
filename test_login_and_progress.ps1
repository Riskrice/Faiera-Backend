
$email = "student@faiera.com"
$password = "P@ssword123!"

Write-Host "Logging in as $email..."
$loginBody = @{
    email    = $email
    password = $password
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginRes.data.tokens.accessToken
    Write-Host "Login successful. Token obtained."
}
catch {
    Write-Host "Login failed: $($_.Exception.Message)"
    exit
}

$headers = @{ "Authorization" = "Bearer $token" }

Write-Host "Testing /progress/my/stats..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/progress/my/stats" -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "Stats Response:"
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Stats Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        Write-Host "Body: $respBody"
    }
}
