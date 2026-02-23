
$baseUrl = "http://localhost:4000/api/v1"
$credentials = @{
    email    = "superadmin@faiera.com"
    password = "P@ssword123!"
}

# 1. Login
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($credentials | ConvertTo-Json) -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken
    Write-Host "Login successful!"
}
catch {
    Write-Host "Login failed"
    exit
}

# 2. Test Upload URL Generation
$headers = @{ "Authorization" = "Bearer $token" }
$body = @{ title = "Test Video Upload" } | ConvertTo-Json

try {
    Write-Host "Testing POST /content/lessons/upload-url..."
    $response = Invoke-RestMethod -Uri "$baseUrl/content/lessons/upload-url" -Method Post -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "Success!"
    Write-Host "Response: $($response | ConvertTo-Json -Depth 10)"
}
catch {
    Write-Host "Failed!"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Body: $($reader.ReadToEnd())"
}
