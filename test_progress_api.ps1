
$token = (Get-Content e:\Faiera\login.json | ConvertFrom-Json).data.tokens.accessToken
$headers = @{ "Authorization" = "Bearer $token" }

Write-Host "Testing /progress/my/stats..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/progress/my/stats" -Method Get -Headers $headers -ErrorAction Stop
    $response | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        Write-Host "Body: $respBody"
    }
}
