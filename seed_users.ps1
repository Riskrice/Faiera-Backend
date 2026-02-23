$baseUrl = "http://localhost:4000/api/v1"
$password = "P@ssword123!"

$accounts = @(
    @{
        email     = "superadmin@faiera.com"
        firstName = "Super"
        lastName  = "Admin"
        role      = "admin"
    },
    @{
        email     = "pro_teacher@faiera.com"
        firstName = "Pro"
        lastName  = "Teacher"
        role      = "teacher"
    },
    @{
        email     = "smart_student@faiera.com"
        firstName = "Smart"
        lastName  = "Student"
        role      = "student"
    }
)

foreach ($acc in $accounts) {
    Write-Host "Registering $($acc.role): $($acc.email)..."
    $body = @{
        email     = $acc.email
        password  = $password
        firstName = $acc.firstName
        lastName  = $acc.lastName
        role      = $acc.role
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $body -ContentType "application/json"
        Write-Host "Success! ID: $($response.data.user.id)"
    }
    catch {
        Write-Host "Failed: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $details = $reader.ReadToEnd()
            Write-Host "Details: $details"
        }
    }
    Write-Host "---------------------------"
}
