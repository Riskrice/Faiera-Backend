
$baseUrl = "http://localhost:4000/api/v1"

# Test Invalid Token
try {
    Write-Host "Testing GET /notifications with INVALID token..."
    $headers = @{ "Authorization" = "Bearer INVALID_TOKEN_123" }
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications" -Method Get -Headers $headers -ErrorAction Stop
}
catch {
    Write-Host "Failed as expected."
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host "Body: $body"
}
