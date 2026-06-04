param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$copilotSkills = Join-Path $HOME '.copilot/skills'
$backupRoot = Join-Path $HOME '.copilot/skills-backups'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$repoInstruction = Join-Path $repoRoot '.github/instructions/frontend-taste.instructions.md'
$repoInstructionBackupRoot = Join-Path $HOME '.copilot/skills-backups-repo/pop-installater/instructions'

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

function Write-Step([string]$message) {
    Write-Host "- $message"
}

function Remove-Skill([string]$name) {
    $target = Join-Path $copilotSkills $name
    if (-not (Test-Path $target)) {
        Write-Step "skip remove (missing): $name"
        return
    }

    if ($DryRun) {
        Write-Step "dry-run remove: $target"
        return
    }

    Remove-Item -Path $target -Recurse -Force
    Write-Step "removed: $target"
}

function Restore-LatestBackup([string]$name) {
    if (-not (Test-Path $backupRoot)) {
        return
    }

    $latest = Get-ChildItem $backupRoot -Directory |
        Where-Object { $_.Name -match ('^' + [regex]::Escape($name) + '-\d{8}-\d{6}$') } |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if (-not $latest) {
        return
    }

    $target = Join-Path $copilotSkills $name
    if ($DryRun) {
        Write-Step "dry-run restore: $($latest.FullName) -> $target"
        return
    }

    Copy-Item -Path $latest.FullName -Destination $target -Recurse -Force
    Write-Step "restored backup: $($latest.Name) -> $target"
}

function Restore-RepoInstructionBackup {
    if (-not (Test-Path $repoInstructionBackupRoot)) {
        if (Test-Path $repoInstruction) {
            if ($DryRun) {
                Write-Step "dry-run remove repo instruction: $repoInstruction"
            } else {
                Remove-Item -Path $repoInstruction -Force
                Write-Step "removed repo instruction: $repoInstruction"
            }
        } else {
            Write-Step 'skip repo instruction remove (missing)'
        }
        return
    }

    $latest = Get-ChildItem $repoInstructionBackupRoot -File -Filter 'frontend-taste.instructions.md-*' |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if (-not $latest) {
        if (Test-Path $repoInstruction) {
            if ($DryRun) {
                Write-Step "dry-run remove repo instruction: $repoInstruction"
            } else {
                Remove-Item -Path $repoInstruction -Force
                Write-Step "removed repo instruction: $repoInstruction"
            }
        } else {
            Write-Step 'skip repo instruction remove (missing)'
        }
        return
    }

    if ($DryRun) {
        Write-Step "dry-run restore repo instruction: $($latest.FullName) -> $repoInstruction"
        return
    }

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $repoInstruction) | Out-Null
    Copy-Item -Path $latest.FullName -Destination $repoInstruction -Force
    Write-Step "restored repo instruction backup: $($latest.Name) -> $repoInstruction"
}

Write-Host 'Rolling back skill integration...'

foreach ($skill in $globalSkills) {
    Remove-Skill -name $skill
    Restore-LatestBackup -name $skill
}

Restore-RepoInstructionBackup

Write-Host 'Rollback completed.'
