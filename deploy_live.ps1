$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$host_ip = "81.0.221.169"
$password = "dn13cpc@LfQT6soj"
$user = "root"

function RunSSH($command, $timeoutMs = 120000) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $plinkPath
    $psi.Arguments = "-ssh -pw `"$password`" $user@$host_ip `"$command`""
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $psi.CreateNoWindow = $true
    
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.WriteLine("y")
    $p.StandardInput.Close()
    
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit($timeoutMs)
    
    if ($stdout) { Write-Host $stdout }
    if ($stderr -and $stderr -notmatch "Permanently added|Warning:") { 
        Write-Host "STDERR: $stderr" -ForegroundColor Yellow 
    }
    return $p.ExitCode
}

Write-Host "=== Step 1: Pull Backend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend && git pull origin main 2>&1"

Write-Host "=== Step 2: .env Keys ===" -ForegroundColor Cyan
# NOTE: Live API keys are stored on the server's .env file directly.
# To update keys, SSH into the server and edit /opt/faiera/backend/.env manually.
Write-Host "Skipping key update - edit .env directly on server if needed" -ForegroundColor Yellow

Write-Host "=== Step 3: Restart Backend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera && docker compose restart backend 2>&1"

Write-Host "=== Deployment Completed ===" -ForegroundColor Green
