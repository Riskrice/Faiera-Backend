$baseUrl = "http://localhost:4000/api/v1"
$credentials = @(
    @{"email" = "superadmin@faiera.com"; "password" = "P@ssword123!" },
    @{"email" = "pro_teacher@faiera.com"; "password" = "P@ssword123!" },
    @{"email" = "smart_student@faiera.com"; "password" = "P@ssword123!" }
)

foreach ($cred in $credentials) {
    Write-Host "Testing login for $($cred.email)..."
    try {
        $body = $cred | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $body -ContentType "application/json"
        Write-Host "Success! Token: $($response.data.tokens.accessToken.Substring(0, 10))..."
    }
    catch {
        Write-Host "Failed: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "Details: $($reader.ReadToEnd())"
        }
    }
    Write-Host "---"
}
