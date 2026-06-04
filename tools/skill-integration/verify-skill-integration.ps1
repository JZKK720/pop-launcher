$ErrorActionPreference = 'Stop'

$copilotSkills = Join-Path $HOME '.copilot/skills'
$globalBackupRoot = Join-Path $HOME '.copilot/skills-backups'
$repoBackupRoot = Join-Path $HOME '.copilot/skills-backups-repo/pop-installater/instructions'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$repoInstruction = Join-Path $repoRoot '.github/instructions/frontend-taste.instructions.md'

$globalSkills = @(
    'karpathy-guidelines',
    'understand',
    'understand-chat',
    'understand-dashboard',
    'understand-domain',
    'understand-explain',
    'understand-onboard',
    'understand-knowledge'
)

$missingSkills = @()
$installedSkills = @()

foreach ($skill in $globalSkills) {
    $skillPath = Join-Path $copilotSkills $skill
    $skillFile = Join-Path $skillPath 'SKILL.md'
    if ((Test-Path $skillPath) -and (Test-Path $skillFile)) {
        $installedSkills += $skill
    } else {
        $missingSkills += $skill
    }
}

$repoInstructionPresent = Test-Path $repoInstruction
$globalBackupsPresent = Test-Path $globalBackupRoot
$repoBackupsPresent = Test-Path $repoBackupRoot

$repoBackupCount = 0
if ($repoBackupsPresent) {
    $repoBackupCount = (Get-ChildItem $repoBackupRoot -File -Filter 'frontend-taste.instructions.md-*' | Measure-Object).Count
}

Write-Host 'Skill Integration Verification'
Write-Host '=============================='
Write-Host "Copilot skills dir: $copilotSkills"
Write-Host "Repo instruction:   $repoInstruction"
Write-Host ''

Write-Host 'Installed global skills:'
if ($installedSkills.Count -eq 0) {
    Write-Host '- none'
} else {
    $installedSkills | Sort-Object | ForEach-Object { Write-Host "- $_" }
}

Write-Host ''
Write-Host 'Missing global skills:'
if ($missingSkills.Count -eq 0) {
    Write-Host '- none'
} else {
    $missingSkills | Sort-Object | ForEach-Object { Write-Host "- $_" }
}

Write-Host ''
Write-Host "Repo instruction present: $repoInstructionPresent"
Write-Host "Global backup root present: $globalBackupsPresent"
Write-Host "Repo backup root present:   $repoBackupsPresent"
Write-Host "Repo backup file count:     $repoBackupCount"

if ($missingSkills.Count -gt 0 -or -not $repoInstructionPresent) {
    Write-Host ''
    Write-Warning 'Verification failed. Run apply script to repair integration.'
    exit 1
}

Write-Host ''
Write-Host 'Verification passed.'
