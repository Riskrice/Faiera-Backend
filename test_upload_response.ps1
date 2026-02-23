
$baseUrl = "http://localhost:4000/api/v1"
$credentials = @{
    email    = "superadmin@faiera.com"
    password = "P@ssword123!"
}

# 1. Login
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($credentials | ConvertTo-Json) -ContentType "application/json"
$token = $loginResponse.data.tokens.accessToken

# 2. Test Upload URL Generation
$headers = @{ "Authorization" = "Bearer $token" }
$body = @{ title = "Test Video Upload" } | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$baseUrl/content/lessons/upload-url" -Method Post -Headers $headers -Body $body -ContentType "application/json"

# Output ONLY the data portion as formatted JSON
$response.data | ConvertTo-Json -Depth 5
