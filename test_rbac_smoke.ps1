$ErrorActionPreference = 'Stop'
Set-Location "E:\Faiera"

$base = 'http://localhost:4000/api/v1'
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$adminEmail = "rbac.smoke.$timestamp@faiera.com"

function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) {
        throw $message
    }
}

try {
    $loginBody = @{ email = 'superadmin@faiera.com'; password = 'P@ssword123!' } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $loginBody -ContentType 'application/json'
    $token = $loginResp.data.tokens.accessToken
    Assert-True (-not [string]::IsNullOrWhiteSpace($token)) 'Missing access token from login'
    $headers = @{ Authorization = "Bearer $token" }
    Write-Output 'SMOKE_LOGIN=OK'

    $permissions = (Invoke-RestMethod -Uri "$base/admin/rbac/permissions" -Method Get -Headers $headers).data
    Assert-True ($permissions.Count -gt 0) 'No RBAC permissions returned'

    $role1PermIds = @($permissions | Where-Object { $_.resource -eq 'users' -and $_.action -in @('view', 'manage') } | Select-Object -ExpandProperty id)
    if ($role1PermIds.Count -eq 0) {
        $role1PermIds = @($permissions[0].id)
    }

    $role2PermIds = @($permissions | Where-Object { $_.resource -eq 'audit' -and $_.action -eq 'view' } | Select-Object -ExpandProperty id)
    if ($role2PermIds.Count -eq 0) {
        $role2PermIds = @($permissions[-1].id)
    }

    $role1Body = @{ name = "Smoke Role A $timestamp"; description = 'smoke role A'; permissionIds = $role1PermIds } | ConvertTo-Json -Depth 10
    $role1 = (Invoke-RestMethod -Uri "$base/admin/rbac/roles" -Method Post -Headers $headers -Body $role1Body -ContentType 'application/json').data
    Write-Output "SMOKE_ROLE1_CREATED=$($role1.id)"

    $role2Body = @{ name = "Smoke Role B $timestamp"; description = 'smoke role B'; permissionIds = $role2PermIds } | ConvertTo-Json -Depth 10
    $role2 = (Invoke-RestMethod -Uri "$base/admin/rbac/roles" -Method Post -Headers $headers -Body $role2Body -ContentType 'application/json').data
    Write-Output "SMOKE_ROLE2_CREATED=$($role2.id)"

    $adminBody = @{
        firstName = 'Smoke'
        lastName = 'Admin'
        email = $adminEmail
        password = 'P@ssword123!'
        roleId = $role1.id
        preferredLanguage = 'ar'
    } | ConvertTo-Json
    $adminResp = (Invoke-RestMethod -Uri "$base/admin/rbac/admins" -Method Post -Headers $headers -Body $adminBody -ContentType 'application/json').data
    $adminUserId = $adminResp.userId
    Assert-True (-not [string]::IsNullOrWhiteSpace($adminUserId)) 'Created admin has no userId'
    Write-Output "SMOKE_ADMIN_CREATED=$adminUserId"

    $updateBody = @{ roleId = $role2.id } | ConvertTo-Json
    $updatedAdmin = (Invoke-RestMethod -Uri "$base/admin/rbac/admins/$adminUserId/role" -Method Patch -Headers $headers -Body $updateBody -ContentType 'application/json').data
    Assert-True ($updatedAdmin.roleId -eq $role2.id) 'Admin role update did not persist'
    Write-Output 'SMOKE_ADMIN_ROLE_UPDATE=OK'

    $blockedByTarget = $false
    try {
        $escalateBody1 = @{ role = 'teacher' } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/users/$adminUserId/role" -Method Patch -Headers $headers -Body $escalateBody1 -ContentType 'application/json' | Out-Null
    }
    catch {
        $blockedByTarget = $true
    }
    Assert-True $blockedByTarget 'Expected /users/:id/role to block mutation on admin accounts'
    Write-Output 'SMOKE_GUARD_ADMIN_ACCOUNT=OK'

    $revokedAdmin = (Invoke-RestMethod -Uri "$base/admin/rbac/admins/$adminUserId" -Method Delete -Headers $headers).data
    Assert-True ($null -ne $revokedAdmin.revokedAt) 'Admin revoke did not set revokedAt'
    Write-Output 'SMOKE_ADMIN_REVOKE=OK'

    $blockedPrivilegedRole = $false
    try {
        $escalateBody2 = @{ role = 'admin' } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/users/$adminUserId/role" -Method Patch -Headers $headers -Body $escalateBody2 -ContentType 'application/json' | Out-Null
    }
    catch {
        $blockedPrivilegedRole = $true
    }
    Assert-True $blockedPrivilegedRole 'Expected /users/:id/role to block privileged role escalation'
    Write-Output 'SMOKE_GUARD_PRIVILEGED_ROLE=OK'

    $audit = Invoke-RestMethod -Uri "$base/admin/rbac/audit?targetUserId=$adminUserId&pageSize=20" -Method Get -Headers $headers
    $auditCount = @($audit.data.items).Count
    Assert-True ($auditCount -ge 3) "Expected audit entries for target user, got $auditCount"
    Write-Output "SMOKE_AUDIT_COUNT=$auditCount"

    foreach ($roleId in @($role1.id, $role2.id)) {
        try {
            Invoke-RestMethod -Uri "$base/admin/rbac/roles/$roleId" -Method Delete -Headers $headers | Out-Null
            Write-Output "SMOKE_ROLE_DELETE_OK=$roleId"
        }
        catch {
            Write-Output "SMOKE_ROLE_DELETE_SKIPPED=$roleId"
        }
    }
    Write-Output 'SMOKE_ROLE_CLEANUP=COMPLETE'

    Write-Output 'RBAC_SMOKE_TEST=PASS'
}
catch {
    Write-Output 'RBAC_SMOKE_TEST=FAIL'
    Write-Output $_.Exception.Message

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Output ($reader.ReadToEnd())
    }

    exit 1
}
