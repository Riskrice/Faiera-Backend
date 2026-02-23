
$email = "teacher@faiera.com"
$password = "P@ssword123!"

# 1. Login
Write-Host "Logging in..."
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.data.tokens.accessToken
$headers = @{ "Authorization" = "Bearer $token" }

# 2. Request Upload URL
Write-Host "Requesting Bunny.net Upload URL..."
$uploadBody = @{ title = "Test Video Upload" } | ConvertTo-Json
try {
    $uploadRes = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/content/lessons/upload-url" -Method Post -Headers $headers -Body $uploadBody -ContentType "application/json"
    Write-Host "Upload Credentials Received:"
    $uploadRes | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Failed to get upload URL: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd())"
    }
}
