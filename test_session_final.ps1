$adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxYTU1ZWU5NS01NWYzLTRhNTUtYWVjOC0xNTc0NjlhNzdlNjEiLCJlbWFpbCI6ImFkbWluQGZhaWVyYS5jb20iLCJyb2xlIjoiYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJjb250ZW50OnJlYWQiLCJjb250ZW50OndyaXRlIiwiY29udGVudDpwdWJsaXNoIiwidXNlcjpyZWFkIiwidXNlcjp3cml0ZSIsInN1YnNjcmlwdGlvbjpyZWFkIiwic3Vic2NyaXB0aW9uOndyaXRlIiwic2Vzc2lvbjptYW5hZ2UiLCJhc3Nlc3NtZW50OnJlYWQiLCJhc3Nlc3NtZW50OndyaXRlIiwicXVlc3Rpb246cmV2aWV3IiwicXVlc3Rpb246YXBwcm92ZSIsInBheW1lbnQ6cmVhZCIsInBheW1lbnQ6d3JpdGUiLCJhZG1pbjpkYXNoYm9hcmQiLCJhZG1pbjphbmFseXRpY3MiXSwiaWF0IjoxNzY5MjIzODMzLCJleHAiOjE3NjkyMjQ3MzN9.C60VK199TCc_PkrqoKX2nG9xNHoL7mZf6nAmAjWWj3U"
$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type"  = "application/json"
}

$body = @{
    titleAr            = "Test Session Admin"
    titleEn            = "Test Session Admin"
    type               = "group"
    grade              = "10"
    subject            = "Mathematics"
    scheduledStartTime = (Get-Date).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    durationMinutes    = 60
} | ConvertTo-Json

Write-Host "Creating Session..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/sessions" -Method Post -Headers $headers -Body $body
    $sessionId = $response.data.id
    Write-Host "Created Session ID: $sessionId"

    Write-Host "Testing Join Link..."
    $joinResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/sessions/$sessionId/join-link" -Method Get -Headers $headers
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
