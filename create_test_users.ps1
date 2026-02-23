$baseUrl = "http://localhost:4000/api/v1/auth/register"
$users = @(
    @{ firstName = "Admin"; lastName = "User"; email = "admin@faiera.com"; password = "P@ssword123!"; role = "admin" },
    @{ firstName = "Teacher"; lastName = "User"; email = "teacher@faiera.com"; password = "P@ssword123!"; role = "teacher" },
    @{ firstName = "Student"; lastName = "User"; email = "student@faiera.com"; password = "P@ssword123!"; role = "student" }
)

foreach ($u in $users) {
    try {
        $body = $u | ConvertTo-Json
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType "application/json"
        Write-Host "Created $($u.role): $($u.email)"
    }
    catch {
        Write-Host "Failed to create $($u.role) ($($u.email)): $($_.Exception.Message)"
        if ($_.Exception.Response) {
            # Attempt to read response body for details
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $details = $reader.ReadToEnd()
                    Write-Host "Details: $details"
                }
            }
            catch {}
        }
    }
}
