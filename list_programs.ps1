
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

# 2. Get Programs
$headers = @{ "Authorization" = "Bearer $token" }
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/content/programs" -Method Get -Headers $headers -ContentType "application/json"
    Write-Host "Programs Count: $($response.data.count)"
    $response.data.items | ForEach-Object { Write-Host "Program: $($_.titleAr) ($(_.id))" }
}
catch {
    Write-Host "Failed to fetch programs: $($_.Exception.Message)"
}
