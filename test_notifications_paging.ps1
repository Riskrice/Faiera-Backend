
$baseUrl = "http://localhost:4000/api/v1"
$credentials = @{
    email    = "superadmin@faiera.com"
    password = "P@ssword123!"
}

# 1. Login
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($credentials | ConvertTo-Json) -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken
}
catch {
    Write-Host "Login failed"
    exit
}

# 2. Test Get Notifications with pagination params
$headers = @{ "Authorization" = "Bearer $token" }
try {
    Write-Host "Testing GET /notifications with page and pageSize..."
    # Using pageSize=5 to verify parameter acceptance
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications?page=1&pageSize=5" -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "Success! Unread Count: $($response.unreadCount)"
}
catch {
    Write-Host "Failed!"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Body: $($reader.ReadToEnd())"
}
