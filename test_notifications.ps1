
$baseUrl = "http://localhost:4000/api/v1"
$credentials = @{
    email    = "superadmin@faiera.com"
    password = "P@ssword123!"
}

# 1. Login
try {
    Write-Host "Logging in..."
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($credentials | ConvertTo-Json) -ContentType "application/json"
    $token = $loginResponse.data.tokens.accessToken
    Write-Host "Login successful. Token obtained."
}
catch {
    Write-Host "Login failed: $($_.Exception.Message)"
    exit
}

# 2. Test Get Notifications
$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    Write-Host "Testing GET /notifications..."
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications" -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "GET /notifications success!"
    Write-Host "Unread Count: $($response.unreadCount)"
    Write-Host "Data count: $($response.data.Count)"
}
catch {
    Write-Host "GET /notifications failed!"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Body: $($reader.ReadToEnd())"
}

# 3. Test Get Unread Count
try {
    Write-Host "Testing GET /notifications/unread-count..."
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications/unread-count" -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "GET /notifications/unread-count success!"
    Write-Host "Count: $($response.data.count)"
}
catch {
    Write-Host "GET /notifications/unread-count failed!"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Body: $($reader.ReadToEnd())"
}
