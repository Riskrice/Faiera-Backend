
$email = "student@faiera.com"
$password = "P@ssword123!"
$baseUrl = "http://localhost:4000/api/v1"

# 1. Login to get token
Write-Host "1. Logging in..." -ForegroundColor Cyan
try {
    $loginBody = @{ email = $email; password = $password } | ConvertTo-Json
    $loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginRes.data.tokens.accessToken
    Write-Host "   Login successful. Token obtained." -ForegroundColor Green
}
catch {
    Write-Host "   Login Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{ "Authorization" = "Bearer $token" }

# 2. Get Current Profile
Write-Host "`n2. Fetching Current Profile..." -ForegroundColor Cyan
try {
    $profile = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "   Current Bio: '$($profile.data.metadata.bio)'" -ForegroundColor Gray
}
catch {
    Write-Host "   Failed to fetch profile: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Update Profile (Bio & Name)
$newBio = "Updated via Script at $(Get-Date -Format 'HH:mm:ss')"
$newName = "Verified User"
Write-Host "`n3. Updating Profile to: Bio='$newBio', Name='$newName'..." -ForegroundColor Cyan

$updateBody = @{
    firstName = "Verified"
    lastName  = "User"
    bio       = $newBio
} | ConvertTo-Json

try {
    $updateRes = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Put -Headers $headers -Body $updateBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "   Update request sent successfully." -ForegroundColor Green
}
catch {
    Write-Host "   Update Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "   Response Body: $($reader.ReadToEnd())" -ForegroundColor Red
    }
    exit 1
}

# 4. Verify Persistence (Fetch again)
Write-Host "`n4. Verifying Persistence..." -ForegroundColor Cyan
try {
    $newProfile = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers $headers -ErrorAction Stop
    $actualBio = $newProfile.data.metadata.bio
    $actualName = "$($newProfile.data.firstName) $($newProfile.data.lastName)"
    
    Write-Host "   Fetched Bio: '$actualBio'"
    Write-Host "   Fetched Name: '$actualName'"

    if ($actualBio -eq $newBio -and $actualName -eq $newName) {
        Write-Host "`n✅ SUCCESS: Profile update persisted correctly!" -ForegroundColor Green
    }
    else {
        Write-Host "`n❌ FAILURE: Data mismatch." -ForegroundColor Red
        Write-Host "   Expected Bio: $newBio" -ForegroundColor Red
        Write-Host "   Expected Name: $newName" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "   Verification Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
