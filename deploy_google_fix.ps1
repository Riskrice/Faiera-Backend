$server = "root@81.0.221.169"
$password = "dn13cpc@LfQT6soj"
$hostkey = "ssh-ed25519 255 SHA256:Ld05/Ty6P4RTJ/bla4BdRuq7vWMeiptFoWhvxRZYRyM"
$root = "E:\Faiera"

# Files changed in backend
$backendFiles = @(
    "src/modules/auth/controllers/auth.controller.ts",
    "src/modules/auth/strategies/google.strategy.ts"
)

# Frontend files changed
$frontendRoot = "E:\faiera-web"
$frontendFiles = @(
    "src/components/auth/login-form.tsx",
    "src/components/auth/register-form.tsx"
)

function RunSSH($command, $timeoutMs = 300000) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "C:\Program Files\PuTTY\plink.exe"
    $psi.Arguments = "-ssh -pw `"$password`" -hostkey `"$hostkey`" $server `"$command`""
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit($timeoutMs)
    if ($stdout) { Write-Host $stdout }
    if ($stderr -and $stderr -notmatch "Permanently added|Warning:") { 
        Write-Host "STDERR: $stderr" -ForegroundColor Yellow 
    }
    return $p.ExitCode
}

function UploadFiles($fileList, $localRoot, $remotePath) {
    $dirs = $fileList | ForEach-Object { (Split-Path $_ -Parent) -replace "\\","/" } | Sort-Object -Unique
    $mkdirCmd = ($dirs | ForEach-Object { "mkdir -p '${remotePath}/$_'" }) -join "; "
    & "C:\Program Files\PuTTY\plink.exe" -ssh $server -pw $password -hostkey $hostkey -batch $mkdirCmd
    
    foreach ($f in $fileList) {
        $localPath = Join-Path $localRoot $f
        $remoteFile = "${server}:${remotePath}/" + ($f -replace "\\","/")
        Write-Host "Uploading: $f"
        & "C:\Program Files\PuTTY\pscp.exe" -pw $password -hostkey $hostkey $localPath $remoteFile
        if ($LASTEXITCODE -eq 0) { Write-Host "OK" -ForegroundColor Green } 
        else { Write-Host "FAILED: $f" -ForegroundColor Red }
    }
}

Write-Host "=== Step 1: Upload Backend Files ===" -ForegroundColor Cyan
UploadFiles $backendFiles $root "/opt/faiera/backend"

Write-Host "=== Step 2: Rebuild Backend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml build api 2>&1 | tail -15"

Write-Host "=== Step 3: Restart Backend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml up -d --no-deps api 2>&1"

Write-Host "=== Step 4: Upload Frontend Files ===" -ForegroundColor Cyan
UploadFiles $frontendFiles $frontendRoot "/opt/faiera/faiera-web"

Write-Host "=== Step 5: Rebuild Frontend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -15"

Write-Host "=== Step 6: Restart Frontend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml up -d --no-deps web 2>&1"

Write-Host "=== Checking Status ===" -ForegroundColor Cyan
RunSSH "docker ps --format 'table {{.Names}}\t{{.Status}}' 2>&1"

Write-Host "=== Full Deployment Done! ===" -ForegroundColor Green
