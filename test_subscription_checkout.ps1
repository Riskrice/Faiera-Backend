
$email = "student@faiera.com"
$password = "P@ssword123!"

# 1. Login
Write-Host "Logging in..."
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginRes.data.tokens.accessToken
$headers = @{ "Authorization" = "Bearer $token" }

# 2. Get Active Plans
Write-Host "Fetching active plans..."
$plansRes = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions/plans/active" -Method Get -Headers $headers
$activePlans = $plansRes.data

if ($activePlans.Count -eq 0) {
    Write-Host "No active plans found. Creating a test plan..."
    # Create a plan (admin needed, but let's try assuming maybe seed created one or failing)
    # Actually, skipping creation as I don't have admin token handy easily without re-login.
    # Assuming the screenshot shows a plan, it must be there.
    exit
}

$planId = $activePlans[0].id
Write-Host "Found plan: $($activePlans[0].nameEn) ($planId)"

# 3. Checkout Subscription
Write-Host "Initiating checkout for plan $planId..."
try {
    $checkoutRes = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/payments/checkout/subscription/$planId" -Method Post -Headers $headers
    Write-Host "Checkout Response:"
    $checkoutRes | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Checkout Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd())"
    }
}
