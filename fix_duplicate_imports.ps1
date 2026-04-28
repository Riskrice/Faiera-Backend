$ErrorActionPreference = "Stop"
Set-Location "E:\faiera-web"

$tableFiles = @(
  "src/app/(dashboard)/dashboard/sessions/page.tsx",
  "src/app/(dashboard)/dashboard/students/page.tsx",
  "src/app/(dashboard)/dashboard/subscriptions/page.tsx",
  "src/app/(dashboard)/dashboard/teachers/page.tsx",
  "src/app/(dashboard)/dashboard/withdrawals/page.tsx"
)

foreach ($f in $tableFiles) {
  $content = Get-Content -LiteralPath $f -Raw -Encoding UTF8
  $content = [regex]::Replace($content, '(?m)^\s*import \{ TableSkeleton \} from "@/components/ui/data-states";\r?\n', '')
  $content = [regex]::Replace(
    $content,
    '(?m)^(\s*["'']use client["''];?\r?\n)',
    '$1import { TableSkeleton } from "@/components/ui/data-states";`r`n',
    1
  )
  Set-Content -LiteralPath $f -Value $content -Encoding UTF8 -NoNewline
  Write-Output "CLEANED=$f"
}

$onboarding = "src/app/(dashboard)/student/onboarding/page.tsx"
$onboardingContent = Get-Content -LiteralPath $onboarding -Raw -Encoding UTF8
$onboardingContent = [regex]::Replace($onboardingContent, '(?m)^\s*import \{ GridSkeleton \} from "@/components/ui/course-skeleton";\r?\n', '')
$onboardingContent = [regex]::Replace(
  $onboardingContent,
  '(?m)^(\s*["'']use client["''];?\r?\n)',
  '$1import { GridSkeleton } from "@/components/ui/course-skeleton";`r`n',
  1
)
Set-Content -LiteralPath $onboarding -Value $onboardingContent -Encoding UTF8 -NoNewline
Write-Output "CLEANED=$onboarding"
