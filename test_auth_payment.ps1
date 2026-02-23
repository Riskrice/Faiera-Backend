$baseUrl = "http://localhost:4000/api/v1"
$studentEmail = "student_test_$(Get-Random)@example.com"
$password = "P@ssword123!"

# 1. Register Student
Write-Host "1. Registering new student ($studentEmail)..."
$registerBody = @{
    email     = $studentEmail
    password  = $password
    firstName = "Test"
    lastName  = "Student"
    role      = "student"
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    $studentToken = $regResponse.data.tokens.accessToken
    $studentId = $regResponse.data.user.id
    Write-Host "Success! Student ID: $studentId"
}
catch {
    Write-Host "Registration failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $details = $reader.ReadToEnd()
        Write-Host "Details: $details"
    }
    exit 1
}

# 2. Login as Admin to check/create Plan
Write-Host "`n2. Logging in as Admin..."
$adminLoginBody = @{
    email    = "admin@faiera.com"
    password = "P@ssword123!"
} | ConvertTo-Json
$adminResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json"
$adminToken = $adminResponse.data.tokens.accessToken

$adminHeaders = @{ "Authorization" = "Bearer $adminToken" }

Write-Host "Checking for active plans..."
$plansResponse = Invoke-RestMethod -Uri "$baseUrl/subscriptions/plans" -Method Get -Headers $adminHeaders
$plan = $plansResponse.data.plans | Select-Object -First 1

if ($null -eq $plan) {
    Write-Host "No plans found. Creating a test plan (monthly)..."
    $planBody = @{
        nameAr        = "Plan Arabic"
        nameEn        = "Test Plan"
        descriptionAr = "Description Arabic"
        descriptionEn = "Plan Description"
        price         = 100
        currency      = "EGP"
        durationDays  = 30
        grade         = "10"
        type          = "monthly"
        subjects      = @("Mathematics")
    } | ConvertTo-Json
    $plan = (Invoke-RestMethod -Uri "$baseUrl/subscriptions/plans" -Method Post -Headers $adminHeaders -Body $planBody -ContentType "application/json").data
}
Write-Host "Target Plan ID: $($plan.id) ($($plan.nameEn))"

# 3. Create Checkout Session as Student
Write-Host "`n3. Creating checkout session for student..."
$studentHeaders = @{ 
    "Authorization" = "Bearer $studentToken" 
    "Content-Type"  = "application/json"
}

try {
    $checkoutResponse = Invoke-RestMethod -Uri "$baseUrl/payments/checkout/subscription/$($plan.id)" -Method Post -Headers $studentHeaders
    Write-Host "Success! Payment URL Generated:"
    Write-Host $checkoutResponse.data.paymentUrl
    Write-Host "`nInvoice ID: $($checkoutResponse.data.invoiceId)"
}
catch {
    Write-Host "Checkout failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $details = $reader.ReadToEnd()
        Write-Host "Details: $details"
    }
}
