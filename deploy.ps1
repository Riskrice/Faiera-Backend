$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$host_ip = "81.0.221.169"
$password = "dn13cpc@LfQT6soj"
$user = "root"

# First, add the host key to registry via plink interactive (yes to accept)
# Use Process with stdin piped
function RunSSH($command, $timeoutMs = 60000) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $plinkPath
    $psi.Arguments = "-ssh -pw `"$password`" $user@$host_ip `"$command`""
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $psi.CreateNoWindow = $true
    
    $p = [System.Diagnostics.Process]::Start($psi)
    # Send 'y' to accept host key if prompted
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

Write-Host "=== Step 1: Check server structure ===" -ForegroundColor Cyan
RunSSH "ls /opt/faiera/"

Write-Host "`n=== Step 2: Find .env files ===" -ForegroundColor Cyan
RunSSH "find /opt/faiera -name '.env' -maxdepth 4 2>/dev/null"

Write-Host "`n=== Step 3: Pull Backend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/backend && git pull origin main 2>&1" 90000

Write-Host "`n=== Step 4: Force Pull Frontend ===" -ForegroundColor Cyan
RunSSH "cd /opt/faiera/faiera-web && git fetch origin main && git reset --hard origin/main 2>&1" 90000

Write-Host "`n=== Step 5: Docker compose files ===" -ForegroundColor Cyan
RunSSH "find /opt/faiera -name 'docker-compose*.yml' 2>/dev/null"

Write-Host "`n=== DONE ===" -ForegroundColor Green
