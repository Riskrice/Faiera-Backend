$baseUrl = "http://localhost:4000/api/v1"

Write-Host "Logging in as Admin..."
$loginBody = @{
    email    = "admin@faiera.com"
    password = "P@ssword123!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResponse.data.tokens.accessToken

Write-Host "Success! Token obtained."

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

Write-Host "Creating Session..."
$sessionBody = @{
    titleAr            = "Test Session UTC"
    titleEn            = "Test Session UTC"
    type               = "group"
    grade              = "10"
    subject            = "Mathematics"
    scheduledStartTime = (Get-Date).ToUniversalTime().AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ssZ")
    durationMinutes    = 60
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/sessions" -Method Post -Headers $headers -Body $sessionBody
    $sessionId = $response.data.id
    Write-Host "Created Session ID: $sessionId"

    Write-Host "Testing Join Link..."
    $joinResponse = Invoke-RestMethod -Uri "$baseUrl/sessions/$sessionId/join-link" -Method Get -Headers $headers
    $joinResponse | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $details = $reader.ReadToEnd()
        Write-Host "Details: $details"
    }
}
