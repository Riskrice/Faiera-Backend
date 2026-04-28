$ErrorActionPreference = "Stop"
$server = "root@81.0.221.169"
$password = "dn13cpc@LfQT6soj"
$hostkey = "ssh-ed25519 255 SHA256:Ld05/Ty6P4RTJ/bla4BdRuq7vWMeiptFoWhvxRZYRyM"
$root = "E:\faiera-web"

$files = @(
"src/app/(dashboard)/dashboard/analytics/page.tsx",
"src/app/(dashboard)/dashboard/students/page.tsx",
"src/app/(dashboard)/dashboard/sessions/page.tsx",
"src/app/(dashboard)/dashboard/teachers/page.tsx",
"src/app/(dashboard)/dashboard/subscriptions/page.tsx",
"src/app/(dashboard)/dashboard/withdrawals/page.tsx",
"src/app/(dashboard)/dashboard/question-bank/page.tsx",
"src/app/(dashboard)/dashboard/assessments/page.tsx",
"src/app/(dashboard)/dashboard/assessments/[id]/results/page.tsx",
"src/app/(dashboard)/student/onboarding/page.tsx",
"src/app/(dashboard)/teacher/page.tsx",
"src/app/(dashboard)/teacher/wallet/page.tsx",
"src/components/dashboard/courses-table.tsx",
"src/components/questions/question-picker.tsx",
"src/components/ui/data-states.tsx",
"src/components/ui/course-skeleton.tsx"
)

$dirs = $files | ForEach-Object { (Split-Path $_ -Parent) -replace "\\","/" } | Sort-Object -Unique
$mkdirCmd = ($dirs | ForEach-Object { "mkdir -p '/opt/faiera/faiera-web/$_'" }) -join "; "
& "C:\Program Files\PuTTY\plink.exe" -ssh $server -pw $password -hostkey $hostkey -batch $mkdirCmd
if ($LASTEXITCODE -ne 0) { throw "mkdir failed" }

$failed = @()
foreach ($f in $files) {
  $localPath = Join-Path $root $f
  $remotePath = "/opt/faiera/faiera-web/" + ($f -replace "\\","/")
  & "C:\Program Files\PuTTY\pscp.exe" -pw $password -hostkey $hostkey $localPath "${server}:$remotePath" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $failed += $f
  } else {
    Write-Output ("UPLOADED=" + $f)
  }
}

Write-Output ("UPLOAD_FAILED_COUNT=" + $failed.Count)
$failed | ForEach-Object { Write-Output ("FAILED=" + $_) }
if ($failed.Count -gt 0) { exit 2 }
