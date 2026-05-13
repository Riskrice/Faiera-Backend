$server = "root@81.0.221.169"
$password = "dn13cpc@LfQT6soj"
$hostkey = "ssh-ed25519 255 SHA256:Ld05/Ty6P4RTJ/bla4BdRuq7vWMeiptFoWhvxRZYRyM"

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
    if ($stderr -and $stderr -notmatch "Permanently added|Warning:") { 
        Write-Host "STDERR: $stderr" -ForegroundColor Yellow 
    }
    return $p.ExitCode
}

Write-Host "=== Rebuilding faiera-web Docker image ===" -ForegroundColor Cyan
Write-Host "(This may take 3-5 minutes...)" -ForegroundColor Yellow
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -30"

Write-Host "=== Restarting faiera-web container ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend/docker && docker compose -f docker-compose.prod.yml up -d --no-deps web 2>&1"

Write-Host "=== Checking container status ===" -ForegroundColor Cyan
RunSSH "docker ps --filter name=faiera-web --format 'table {{.Names}}\t{{.Status}}' 2>&1"

Write-Host "=== Frontend Deployment Done! ===" -ForegroundColor Green
