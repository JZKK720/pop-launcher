param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$integrationRoot = Join-Path $HOME '.skill-integrations'
$copilotSkills = Join-Path $HOME '.copilot/skills'
$backupRoot = Join-Path $HOME '.copilot/skills-backups'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$instructionTarget = Join-Path $repoRoot '.github/instructions/frontend-taste.instructions.md'
$instructionTemplate = Join-Path $PSScriptRoot 'templates/frontend-taste.instructions.md'
$instructionBackupRoot = Join-Path $HOME '.copilot/skills-backups-repo/pop-installater/instructions'

$karpathyRepo = Join-Path $integrationRoot 'andrej-karpathy-skills'
$understandRepo = Join-Path $integrationRoot 'Understand-Anything'

$understandSkills = @(
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

function Ensure-Dir([string]$path) {
    if ($DryRun) {
        Write-Step "dry-run ensure dir: $path"
        return
    }
    New-Item -ItemType Directory -Force -Path $path | Out-Null
}

function Sync-Repo([string]$repoUrl, [string]$repoDir) {
    if (Test-Path $repoDir) {
        if ($DryRun) {
            Write-Step "dry-run sync repo: $repoDir (fetch/reset origin/main)"
            return
        }
        git -C $repoDir fetch --all --prune | Out-Null
        git -C $repoDir reset --hard origin/main | Out-Null
        Write-Step "synced repo: $repoDir"
        return
    }

    if ($DryRun) {
        Write-Step "dry-run clone: $repoUrl -> $repoDir"
        return
    }

    git clone $repoUrl $repoDir | Out-Null
    Write-Step "cloned repo: $repoDir"
}

function Backup-Directory([string]$sourcePath, [string]$namePrefix, [string]$destinationRoot) {
    if (-not (Test-Path $sourcePath)) {
        return
    }

    $backupPath = Join-Path $destinationRoot ("$namePrefix-$timestamp")

    if ($DryRun) {
        Write-Step "dry-run backup: $sourcePath -> $backupPath"
        return
    }

    Ensure-Dir -path $destinationRoot
    Copy-Item -Path $sourcePath -Destination $backupPath -Recurse -Force
    Write-Step "backed up: $sourcePath -> $backupPath"
}

function Install-GlobalSkill([string]$sourceDir, [string]$skillName) {
    if (-not (Test-Path $sourceDir)) {
        throw "Source skill not found: $sourceDir"
    }

    $targetDir = Join-Path $copilotSkills $skillName

    Backup-Directory -sourcePath $targetDir -namePrefix $skillName -destinationRoot $backupRoot

    if ($DryRun) {
        Write-Step "dry-run install global skill: $sourceDir -> $targetDir"
        return
    }

    Remove-Item -Path $targetDir -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path $sourceDir -Destination $targetDir -Recurse -Force

    if (-not (Test-Path (Join-Path $targetDir 'SKILL.md'))) {
        throw "SKILL.md missing after install for $skillName"
    }

    Write-Step "installed global skill: $skillName"
}

function Apply-RepoInstruction {
    if (-not (Test-Path $instructionTemplate)) {
        throw "Instruction template not found: $instructionTemplate"
    }

    Backup-Directory -sourcePath $instructionTarget -namePrefix 'frontend-taste.instructions.md' -destinationRoot $instructionBackupRoot

    if ($DryRun) {
        Write-Step "dry-run apply repo instruction: $instructionTemplate -> $instructionTarget"
        return
    }

    Ensure-Dir -path (Split-Path -Parent $instructionTarget)
    Copy-Item -Path $instructionTemplate -Destination $instructionTarget -Force
    Write-Step "applied repo instruction: $instructionTarget"
}

Write-Host 'Applying skill integration in approved order...'

Ensure-Dir -path $integrationRoot
Ensure-Dir -path $copilotSkills
Ensure-Dir -path $backupRoot

# Step 1: Karpathy (global)
Sync-Repo -repoUrl 'https://github.com/JZKK720/andrej-karpathy-skills.git' -repoDir $karpathyRepo
Install-GlobalSkill -sourceDir (Join-Path $karpathyRepo 'skills/karpathy-guidelines') -skillName 'karpathy-guidelines'

# Step 2: repo-scoped taste profile
Apply-RepoInstruction

# Step 3: Understand-Anything subset (global)
Sync-Repo -repoUrl 'https://github.com/JZKK720/Understand-Anything.git' -repoDir $understandRepo
foreach ($skill in $understandSkills) {
    Install-GlobalSkill -sourceDir (Join-Path $understandRepo ("understand-anything-plugin/skills/$skill")) -skillName $skill
}

Write-Host 'Apply completed.'
