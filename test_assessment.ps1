$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxYTU1ZWU5NS01NWYzLTRhNTUtYWVjOC0xNTc0NjlhNzdlNjEiLCJlbWFpbCI6ImFkbWluQGZhaWVyYS5jb20iLCJyb2xlIjoiYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJjb250ZW50OnJlYWQiLCJjb250ZW50OndyaXRlIiwiY29udGVudDpwdWJsaXNoIiwidXNlcjpyZWFkIiwidXNlcjp3cml0ZSIsInN1YnNjcmlwdGlvbjpyZWFkIiwic3Vic2NyaXB0aW9uOndyaXRlIiwic2Vzc2lvbjptYW5hZ2UiLCJhc3Nlc3NtZW50OnJlYWQiLCJhc3Nlc3NtZW50OndyaXRlIiwicXVlc3Rpb246cmV2aWV3IiwicXVlc3Rpb246YXBwcm92ZSIsInBheW1lbnQ6cmVhZCIsInBheW1lbnQ6d3JpdGUiLCJhZG1pbjpkYXNoYm9hcmQiLCJhZG1pbjphbmFseXRpY3MiXSwiaWF0IjoxNzY5MjIzODMzLCJleHAiOjE3NjkyMjQ3MzN9.C60VK199TCc_PkrqoKX2nG9xNHoL7mZf6nAmAjWWj3U"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

$body = @{
    titleAr          = "اختبار تجريبي 1"
    titleEn          = "Test Quiz 1"
    type             = "quiz"
    grade            = "10"
    subject          = "Mathematics"
    timeLimitMinutes = 30
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/assessments" -Method Post -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
