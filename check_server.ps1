$server = "root@81.0.221.169"
$password = "dn13cpc@LfQT6soj"
$hostkey = "ssh-ed25519 255 SHA256:Ld05/Ty6P4RTJ/bla4BdRuq7vWMeiptFoWhvxRZYRyM"

function RunSSH($command, $timeoutMs = 30000) {
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
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Container Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
RunSSH "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}' 2>&1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Backend (faiera-api) Last 30 Logs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
RunSSH "docker logs faiera-api --tail 30 2>&1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Frontend (faiera-web) Last 15 Logs" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
RunSSH "docker logs faiera-web --tail 15 2>&1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Checking /auth/google/init route" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
RunSSH "curl -s -o /dev/null -w 'HTTP Status: %{http_code}\nRedirect: %{redirect_url}\n' 'http://localhost:4000/api/v1/auth/google/init?redirect=/courses/test' 2>&1"
