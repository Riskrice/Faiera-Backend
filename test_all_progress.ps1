
$email = "student@faiera.com"
$password = "P@ssword123!"

# 1. Login
Write-Host "Logging in..."
try {
    $loginBody = @{ email = $email; password = $password } | ConvertTo-Json
    $loginRes = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginRes.data.tokens.accessToken
    Write-Host "Login successful."
}
catch {
    Write-Host "Login Failed: $($_.Exception.Message)"
    exit
}

$headers = @{ "Authorization" = "Bearer $token" }

function Test-Endpoint($url) {
    Write-Host "Testing $url..."
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -ErrorAction Stop
        Write-Host "Success!"
        # $response | ConvertTo-Json -Depth 2
    }
    catch {
        Write-Host "Failed: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "Body: $($reader.ReadToEnd())"
        }
    }
    Write-Host "--------------------------------"
}

Test-Endpoint "http://localhost:4000/api/v1/progress/my/stats"
Test-Endpoint "http://localhost:4000/api/v1/progress/my/activity"
Test-Endpoint "http://localhost:4000/api/v1/progress/my?limit=10"
