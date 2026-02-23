$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZjZjMmQ5Ny04ZjBiLTQ3YzgtODFlZS1jOTQ5ZWVjNDkzMTAiLCJlbWFpbCI6InRlYWNoZXJAZmFpZXJhLmNvbSIsInJvbGUiOiJ0ZWFjaGVyIiwicGVybWlzc2lvbnMiOlsiY29udGVudDpwdWJsaXNoIiwic2Vzc2lvbjpjcmVhdGUiLCJzZXNzaW9uOm1hbmFnZSIsImFzc2Vzc21lbnQ6cmVhZCIsImFzc2Vzc21lbnQ6d3JpdGUiLCJxdWVzdGlvbjpjb250cmlidXRlIiwidXNlcjpyZWFkIl0sImlhdCI6MTc2OTIyMzkxMSwiZXhwIjoxNzY5MjI0ODExfQ.grdCoyHLOFCK6rBIk9LqZ0CLQ0QEsKOW4t_o7676uHE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

$body = @{
    titleAr            = "Test Session AR"
    titleEn            = "Test Session EN"
    type               = "group"
    grade              = "10"
    subject            = "Mathematics"
    scheduledStartTime = (Get-Date).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    durationMinutes    = 60
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/sessions" -Method Post -Headers $headers -Body $body
$sessionId = $response.data.id

Write-Host "Created Session ID: $sessionId"

# Test join link
$joinResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/sessions/$sessionId/join-link" -Method Get -Headers $headers
$joinResponse | ConvertTo-Json -Depth 10
