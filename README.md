# 智方云cubecloud

Windows desktop app-launch board. One-click access to local EXE programs and localhost URLs, with a glassmorphism UI.

![Platform](https://img.shields.io/badge/platform-Windows%20x64-blue)
![Version](https://img.shields.io/badge/version-1.0.10-blue)
![Electron](https://img.shields.io/badge/electron-34-47848F)
![License](https://img.shields.io/badge/license-Elastic%20License%202.0-orange)

---

## Features

- Launch local EXE programs or `http://` URLs in one click
- Add, edit, delete app shortcuts with custom icons, tags, and tile colors
- Glassmorphism frosted-glass UI with deep-blue panel
- Persistent data in `%AppData%` — survives reinstalls
- Minimize to system tray, restore on double-click
- NSIS installer with Start Menu and Desktop shortcuts

---

## Release Notes

### 1.0.10

- Fixed layout-switch regression where the `+ Add` tile could stay hidden after restoring from compact dock to workspace
- Switching to workspace now always re-renders the grid so add and edit flows are visible and usable again

### 1.0.9

- Enabled drag-reorder in workspace mode even when search results are filtered
- Preserved active search filter after drag-drop reorder

### 1.0.8

- Fixed compact dock regression where the `+ Add` tile could appear and expand interaction hit area in minimized taskbar mode
- Compact mode now hides the add tile entirely; adding apps remains available in workspace mode

### 1.0.7

- Reworked the launcher into a bottom-anchored compact dock and an expanded workspace mode
- Updated the green control to toggle layout modes instead of using a generic maximize behavior
- Made compact mode icon-only, with search available only in workspace mode
- Added horizontal scrolling for compact mode and fixed duplicate icon rendering from overlapping async renders
- Tuned compact dock sizing, hover-only traffic-light controls, and icon spacing for a tighter taskbar-like footprint
- Added single-instance handling and moved Chromium session data to a temp path to eliminate recurring cache startup warnings

### 1.0.6

- Added macOS-style traffic-light window controls (minimize, restore/maximize, close-to-tray)
- Added drag-to-reorder support for launcher app tiles and persisted order to user data
- Fixed window sizing safety for the frameless transparent window with enforced minimum bounds
- Hardened icon file path handling in IPC to prevent traversal outside `%AppData%`
- Fixed drag cancellation state cleanup and reduced per-render allocation overhead in tile rendering

---

## Versioning Policy

This repo follows Semantic Versioning (`MAJOR.MINOR.PATCH`) with a strict release decision rule:

- PATCH (`x.y.Z`): singular bug fix, regression fix, or internal hardening with no new user-facing feature or workflow change
- MINOR (`x.Y.z`): new feature, UI/UX redesign, renderer/layout behavior update, new IPC capability, or build-service/install flow enhancement
- MAJOR (`X.y.z`): breaking behavior or compatibility change (for example user-data format break, unsupported older Windows target, or migration required)

Quick decision checklist before tagging:

1. Is this only a focused fix with no new capability? Use PATCH.
2. Does this add/change user-visible behavior or design? Use MINOR.
3. Does this break compatibility or require migration? Use MAJOR.

Project-specific examples:

- Single path-validation fix in main process: PATCH
- Compact/workspace mode redesign with rerender behavior changes: MINOR
- Data schema migration that needs conversion logic: MAJOR

Release metadata must stay aligned in the same PR/commit:

- `package.json` version
- `README.md` release note and installer filename/version text
- `README_CN.md` release note and installer filename/version text
- `docker-compose.yml` image tag when build-service image version is surfaced
- Run `npm run sync:release-metadata` before build/release

---

## Installation

### Release options

- Primary app delivery: Windows NSIS installer `.exe`
- Parallel build and distribution option: Docker-based HTTP build service that generates and serves the same Windows installer

Users still run **智方云cubecloud** through the Windows installer. The Docker option is for teams or operators who want a general build service for building, hosting, or downloading the installer through HTTP. Webhook-style triggering can be added on top of that service when desired, but it is not required.

### Download (recommended)

1. Go to [Releases](../../releases/latest)
2. Download `智方云cubecloud Setup 1.0.10.exe`
3. Run the installer — choose install directory, click Install
4. Launch from Start Menu or Desktop shortcut: **智方云cubecloud**

**Requirements:** Windows 10 / 11, x64

---

## Development

### Setup

```bash
git clone https://github.com/JZKK720/pop-launcher.git
cd pop-launcher
npm install
```

### Run

```bash
npm start
```

### Build installer

```bash
npm run build
# Output: dist/智方云cubecloud Setup 1.0.10.exe
```

The native Windows packaging flow keeps using the repo-local `dist/` directory.

### Run the HTTP build service locally

```bash
npm run start:build-service
```

Available endpoints:

- `GET /healthz` returns service health and active build state
- `GET /builds` lists recent build jobs
- `POST /builds` starts a new build job
- `GET /builds/:id` returns build status and artifact metadata
- `GET /builds/:id/logs` returns the captured build log
- `GET /builds/:id/artifact` downloads the finished installer for that job
- `GET /artifacts/latest` downloads the latest successful installer

Optional request body for `POST /builds`:

```json
{
	"cleanDist": true,
	"installDependencies": false,
	"command": "npm run build:win"
}
```

If `BUILD_TOKEN` is set, pass it through the `x-build-token` header or the `?token=` query string.

### Run the Docker build service

1. Copy `.env.example` to `.env` and set a real `BUILD_TOKEN` when you need remote access.
2. Start the service:

```bash
npm run docker:build-service
```

3. Trigger a build:

```bash
curl -X POST http://127.0.0.1:3001/builds \
	-H "Content-Type: application/json" \
	-H "x-build-token: change-me" \
	-d '{"cleanDist":true}'
```

4. Download the latest successful installer:

```bash
curl -L "http://127.0.0.1:3001/artifacts/latest?token=change-me" --output cubecloud-installer.exe
```

The container keeps generated installers in `artifacts/` and job metadata plus logs in `build-service-data/`.

The Docker build service uses its own internal build output directory, `docker-dist/`, inside the container image, so it does not overwrite the native `dist/` output used by `npm run build`.

This means version `1.0.10` can be offered with both choices live at the same time:

- Direct installer download for regular Windows users
- Docker build service for automated, team-managed, or optionally webhook-driven installer delivery

### Skill integration commands

This repo includes helper scripts for integrating and validating personal Copilot skills.

```bash
# Kickoff integration (alias of skills:apply)
npm run skills:kickoff

# Apply integration (global skills + repo instruction)
npm run skills:apply

# Dry-run apply (no changes)
npm run skills:apply:dry

# Rollback integration
npm run skills:rollback

# Dry-run rollback (no changes)
npm run skills:rollback:dry

# Verify integration health
npm run skills:verify
```

For implementation details, see `tools/skill-integration/README.md`.

### Copilot Chat starters (single-line)

```text
Apply karpathy-guidelines, fix <bug> with smallest possible diff, no refactor, run only relevant checks, report changed files.
Apply karpathy-guidelines, reproduce <issue> first, patch root cause only, explain each changed line.
Apply understand, map architecture/modules/dependency hotspots/top risks, then propose safe edit plan with verification gates.
Apply understand-chat, explain end-to-end flow for <feature> with call path, touched files, config points, and failure modes.
Apply understand-domain, extract domains/flows/steps/dependencies for <business area> and change-risk points.
Use repo frontend taste profile, redesign <UI area> with conservative and bold options, then implement selected one.
Use repo frontend taste profile plus karpathy-guidelines, improve <UI area> with focused diff and no framework migration.
Apply understand for analysis then karpathy-guidelines for implementation; output assumptions, risks, 3-step verified plan, then execute.
Review branch for release risks by severity with file references, include regressions/docs drift, do not run build unless asked.
Audit current changes for functional and rollout risk only, suggest minimal fixes, skip build/test unless explicitly requested.
```

---

## Data & Storage

All user data is stored in `%AppData%\智方云cubecloud\`:

| Path | Contents |
|---|---|
| `apps.json` | App list (name, path, icon, tag, color) |
| `icons/` | Uploaded icon images |

Default apps and icons are seeded from the bundle on first launch.
The NSIS installer also creates timestamped snapshots under `%AppData%\智方云cubecloud-backup\` before upgrade or uninstall so users keep rollback copies of `apps.json` and `icons/`.

When you run the HTTP build service, it also creates repo-local working directories:

| Path | Contents |
|---|---|
| `artifacts/` | Installers exported by the HTTP build service |
| `build-service-data/` | Build job metadata and logs |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 34 |
| Frontend | Vanilla HTML / CSS / JS |
| IPC bridge | `contextBridge` + `preload.js` |
| Packaging | electron-builder, NSIS, Windows x64 |

---

## License

© 2026 智方云 cubecloud.io. Released under the [Elastic License 2.0](LICENSE).

Free to use. Source available. Branding and trademark belong to 智方云 cubecloud.io — you may not alter, remove, or redistribute under a different name or brand.
