$brainPath = Join-Path $env:USERPROFILE ".gemini\antigravity\brain\4fdca1d1-5cd9-4f14-b869-64e43ce1bcb0"
$source = Join-Path $brainPath "concept_student_hologram_1768361870369.png"
$destFile = "e:\faiera-web\public\assets\login-illustration.png"

Write-Host "Updating Login Illustration..."

if (Test-Path -Path $source) {
    Copy-Item -Path $source -Destination $destFile -Force
    Write-Host "✅ Login image updated to 'Student Hologram' concept."
}
else {
    Write-Error "❌ Source image not found at $source"
}
