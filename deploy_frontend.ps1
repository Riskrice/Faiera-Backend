$server = "root@81.0.221.169"
$password = "dn13cpc@LfQT6soj"
$hostkey = "ssh-ed25519 255 SHA256:Ld05/Ty6P4RTJ/bla4BdRuq7vWMeiptFoWhvxRZYRyM"

function UploadFile($localPath, $remotePath) {
    Write-Host "  Uploading: $(Split-Path $localPath -Leaf)" -NoNewline
    & "C:\Program Files\PuTTY\pscp.exe" -pw $password -hostkey $hostkey $localPath "${server}:$remotePath" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green } 
    else { Write-Host " FAILED" -ForegroundColor Red }
}

function RunSSH($command, $timeoutMs = 600000) {
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
    if ($stderr -and $stderr -notmatch "Permanently added|Warning:") { Write-Host "STDERR: $stderr" -ForegroundColor Yellow }
}

Write-Host "=== Uploading Frontend Files ===" -ForegroundColor Cyan
UploadFile "E:\faiera-web\src\components\course\enrollment-card.tsx" "/opt/faiera/faiera-web/src/components/course/enrollment-card.tsx"
UploadFile "E:\faiera-web\src\contexts\auth-context.tsx" "/opt/faiera/faiera-web/src/contexts/auth-context.tsx"
UploadFile "E:\faiera-web\src\app\oauth2\redirect\page.tsx" "/opt/faiera/faiera-web/src/app/oauth2/redirect/page.tsx"

Write-Host "=== Rebuilding Frontend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -10"

Write-Host "=== Restarting Frontend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml up -d --no-deps web 2>&1"

Write-Host "=== Status ===" -ForegroundColor Cyan
RunSSH "docker ps --filter name=faiera-web --format '{{.Names}} {{.Status}}' 2>&1"

Write-Host "=== DONE ===" -ForegroundColor Green
