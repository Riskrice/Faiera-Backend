$brainPath = Join-Path $env:USERPROFILE ".gemini\antigravity\brain\4fdca1d1-5cd9-4f14-b869-64e43ce1bcb0"
$source = Join-Path $brainPath "forgot_pass_illus_clean_1768367752658.png"
$destFile = "e:\faiera-web\public\assets\forgot-password-illustration.png"

if (Test-Path -Path $source) {
    Copy-Item -Path $source -Destination $destFile -Force
    Write-Host "✅ Forgot Password image (Clean Version) copied successfully."
}
else {
    Write-Error "❌ image not found at $source"
}
