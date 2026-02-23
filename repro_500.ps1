$ErrorActionPreference = "Stop"

try {
    Write-Host "1. Registering Host..."
    $regBody = @{
        email     = "host_$(Get-Random)@faiera.com"
        password  = "Password123!"
        firstName = "Host"
        lastName  = "User"
        role      = "teacher"
    } | ConvertTo-Json

    $regResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/register" -Method Post -ContentType "application/json" -Body $regBody
    $hostToken = $regResponse.data.tokens.accessToken
    $hostId = $regResponse.data.user.id
    Write-Host "Host Registered: $hostId"

    Write-Host "`n2. Creating Session..."
    $schedTime = (Get-Date).AddMinutes(5).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $createBody = @{
        titleAr            = "جلسة تجريبية"
        titleEn            = "Test Session"
        descriptionAr      = "وصف"
        descriptionEn      = "Desc"
        scheduledStartTime = $schedTime
        durationMinutes    = 60
        maxParticipants    = 10
        grade              = "10"
        subject            = "Math"
        price              = 0
    } | ConvertTo-Json

    $sessionResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/sessions" -Method Post -ContentType "application/json" -Body $createBody -Headers @{ Authorization = "Bearer $hostToken" }
    $sessionId = $sessionResponse.data.id
    Write-Host "Session Created: $sessionId"

    Write-Host "`n3. Getting Join Link..."
    $joinLinkResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/sessions/$sessionId/join-link" -Method Get -Headers @{ Authorization = "Bearer $hostToken" }
    Write-Host "Join Link Token: $($joinLinkResponse.data.joinToken.Substring(0, 10))..."

    Write-Host "`n4. Recording Join (Triggering 500?)..."
    try {
        $joinResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/sessions/$sessionId/join" -Method Post -Headers @{ Authorization = "Bearer $hostToken" }
        Write-Host "Join Response: $($joinResponse | ConvertTo-Json -Depth 2)"
    }
    catch {
        Write-Error "Join Failed: $_"
        if ($_.Exception.Response) {
            # Print full response body to see the stack trace if dev mode
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host "Response Body: $body" -ForegroundColor Red
        }
    }

}
catch {
    Write-Error "Script Failed: $_"
}
