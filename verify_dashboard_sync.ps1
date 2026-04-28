Set-Location "E:\faiera-web"
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
$local = @{}
foreach($f in $files){ $local[$f] = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLower() }

$quoted = ($files | ForEach-Object { "'/opt/faiera/faiera-web/$($_ -replace '\\','/')'" }) -join " "
$remoteCmd = "sha256sum $quoted"
$lines = & "C:\Program Files\PuTTY\plink.exe" -ssh root@81.0.221.169 -pw "dn13cpc@LfQT6soj" -hostkey "ssh-ed25519 255 SHA256:Ld05/Ty6P4RTJ/bla4BdRuq7vWMeiptFoWhvxRZYRyM" -batch $remoteCmd
$mismatch = @()
foreach($line in $lines){
  if($line -match '^([a-f0-9]{64})\s+(.+)$'){
    $h = $matches[1]
    $p = $matches[2]
    $rel = $p -replace '^/opt/faiera/faiera-web/',''
    if($local.ContainsKey($rel) -and $local[$rel] -ne $h){ $mismatch += $rel }
  }
}
Write-Output ("MATCH_COUNT=" + ($files.Count - $mismatch.Count))
Write-Output ("MISMATCH_COUNT=" + $mismatch.Count)
$mismatch | ForEach-Object { Write-Output ("MISMATCH=" + $_) }
