# Skill Integration Playbook

This folder contains safe, reversible helpers for the skill integration performed on 2026-06-04.

## Integrated Scope

Global Copilot skills installed under `%USERPROFILE%/.copilot/skills`:

- `karpathy-guidelines`
- `understand`
- `understand-chat`
- `understand-dashboard`
- `understand-domain`
- `understand-explain`
- `understand-onboard`
- `understand-knowledge`

Repo-scoped instruction added:

- `.github/instructions/frontend-taste.instructions.md`

## Apply

Dry run first:

```powershell
pwsh -File tools/skill-integration/apply-skill-integration.ps1 -DryRun
```

Execute apply:

```powershell
pwsh -File tools/skill-integration/apply-skill-integration.ps1
```

Order enforced by the script:

1. Global `karpathy-guidelines`
2. Repo-scoped `frontend-taste.instructions.md`
3. Global Understand-Anything subset

## Rollback

Dry run first:

```powershell
pwsh -File tools/skill-integration/rollback-skill-integration.ps1 -DryRun
```

Execute rollback:

```powershell
pwsh -File tools/skill-integration/rollback-skill-integration.ps1
```

## Verify

Run this anytime to validate that integration is still healthy:

```powershell
pwsh -File tools/skill-integration/verify-skill-integration.ps1
```

## Notes

- The rollback script removes the integrated global skills and restores the latest matching backup from `%USERPROFILE%/.copilot/skills-backups` if one exists.
- Repo instruction backups are written outside the workspace to `%USERPROFILE%/.copilot/skills-backups-repo/pop-installater/instructions`.
- For the repo-scoped taste profile, rollback restores the latest external backup if available; otherwise it removes `.github/instructions/frontend-taste.instructions.md`.
- The verify script exits with status code `1` if required global skills or the repo instruction are missing.
- No build commands are used by these scripts.
