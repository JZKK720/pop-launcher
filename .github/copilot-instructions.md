# 智方云cubecloud — Workspace Copilot Instructions

## What This Project Is

**智方云cubecloud** is a local-only Windows desktop app-access board built with Electron.js.
It lets users launch local EXE programs or localhost URLs in one click, and manage their shortcuts (add/delete icons and paths) via a Settings panel. It ships as a Windows NSIS installer that registers in the Start Menu and Taskbar.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron (latest stable) |
| Frontend | Vanilla HTML/CSS/JS — no framework |
| IPC bridge | `contextBridge` + `preload.js` (never `nodeIntegration: true`) |
| Persistent data | `app.getPath('userData')/apps.json` + `userData/icons/` |
| Packaging | electron-builder, NSIS target, Windows x64 only |

---

## Build & Delivery Model

- Start with native Windows packaging as the primary delivery path for this repo and this machine.
- Treat the Dockerized HTTP build service as a local trial and smoke-test path until it is explicitly promoted beyond testing.
- The two build paths must stay aligned on installer output semantics:
  - Primary path: `npm run build` or `npm run build:win` produces the installer in `dist/`
  - Trial path: `npm run start:build-service` or `npm run docker:build-service` runs `tools/build-agent/server.js`, stores job state in `build-service-data/`, exports installers to `artifacts/`, and uses `docker-dist/` inside the container
- The Docker build service builds and serves the installer only. It does **not** replace the Electron app as the product runtime.
- When deciding where to work first, fix or validate the native installer flow before spending time on Docker build-service work.
- The installed launcher must keep working with:
  - absolute local Windows paths opened through `open-app`
  - `http://` or `https://` URLs opened through `open-url`
  - localhost ports published from other local Docker containers
- For reverse-proxy, webhook, or Cloudflare exposure, expose only the HTTP build service. Keep `BUILD_TOKEN` support and preserve forwarded-header handling in `tools/build-agent/server.js` so generated URLs stay correct behind a proxy.
- Prefer linking to [README.md](../README.md) and [README_CN.md](../README_CN.md) for operator steps and endpoint examples instead of duplicating them inside new customization files.

---

## Branding Rules

- **App name**: `智方云cubecloud` — no tagline, no description
- **Logo**: `assets/cubecloud-logo-blue.png` — the **light-blue** variant of the cubecloud logo (512×512 px PNG)
  - Use this for: Windows installer icon, system tray icon, any in-app logo placement
  - The app window background uses a transparent/glassmorphism style — the light-blue logo reads clearly against it
  - Available logo variants (do NOT use for installer/tray):
    - `assets/cubecloud-logo-white.png` — for dark solid backgrounds only
    - `assets/cubecloud-logo-black.png` — for light solid backgrounds only
- **No text branding in the UI** — logo image only, no `<h1>`, no product name string rendered anywhere in the main grid (the installer wizard may show `智方云cubecloud`)

---

## Visual Design

- **Style**: Glassmorphism — `backdrop-filter: blur`, frosted glass panel floating over a dark deep-blue swirl background
- **Window background**: transparent (`transparent: true`, `frame: false`) — the OS desktop shows through; the panel sits centred
- **Panel background**: `rgba(255,255,255,.12)` frosted glass with `backdrop-filter: blur(18px)`, subtle white border
- **App tile icons**: black rounded-square tiles (`border-radius: 16px`, `background: #1a1a1a`) — the icon image sits inside
- **Color tokens** (do not change without being asked):
  ```css
  --glass-bg: rgba(255,255,255,.12);
  --glass-border: rgba(255,255,255,.22);
  --tile-bg: #1a1a1a;
  --tile-hover: #2a2a2a;
  --tile-radius: 16px;
  --text-on-glass: rgba(255,255,255,.92);
  --muted-on-glass: rgba(255,255,255,.62);
  --modal-bg: #ffffff;
  --modal-text: #1a1a1a;
  --accent-blue: #2563eb;
  ```
- **Figma exports**: `assets/figma/` — PNG screenshots of all frames; consult before changing layout

---

## File Structure

```
pop-launcher/
├── .github/
│   ├── copilot-instructions.md   ← this file
│   └── agents/
│       ├── app-builder.agent.md
│       ├── build-service-builder.agent.md
│       └── release-builder.agent.md
├── .env.example                 # Build-service environment defaults
├── Dockerfile                   # Containerized build-service image
├── docker-compose.yml           # Local build-service orchestration
├── main.js                       # Electron main process
├── preload.js                    # contextBridge IPC exposure
├── package.json                  # Electron + electron-builder config
├── src/renderer/
│   ├── index.html                # Main launch grid UI (includes add/edit modal inline)
│   ├── apps.json                 # Bundled default app list
│   └── icons/                   # 6 bundled default app icons
├── assets/
│   ├── cubecloud-logo-blue.png   # ← PRIMARY: 512×512 light-blue logo (USE THIS)
│   ├── cubecloud-logo-white.png  # Alternate white variant
│   ├── cubecloud-logo-black.png  # Alternate black variant
│   └── figma/                   # Figma design PNG exports (reference only)
├── tools/build-agent/
│   └── server.js                 # HTTP build service for installer jobs and artifact download
├── dist/                         # Native electron-builder output (gitignored)
├── artifacts/                    # Build-service exported installers (generated)
└── build-service-data/           # Build-service job metadata and logs (generated)
```

---

## Data Schema

`apps.json` root is an array:
```json
[
  { "name": "string", "path": "C:/path/to/app.exe", "icon": "icons/name.png", "type": "file", "tag": "string", "color": "#1a1a1a" },
  { "name": "string", "path": "http://127.0.0.1:3000", "icon": "icons/name.png", "type": "url", "tag": "string", "color": "#1a1a1a" }
]
```

- `type`: `"file"` for local EXE/folder paths, `"url"` for `http://` or `https://` targets (auto-detected)
- `tag`: user-defined label/category string (e.g. "LLM大模型工具") — displayed as a subtitle or badge
- `color`: hex background color for the tile (user picks from color picker in the add/edit modal) — defaults to `#1a1a1a`
- `icon`: relative path resolved against `app.getPath('userData')` at runtime
- At first launch, copy bundled `src/renderer/apps.json` and `src/renderer/icons/*` into `userData/`

---

## UX Flows (from Figma)

### Main Grid (index.html)
- Frosted glass panel centred on transparent window, ~820px wide
- **Search bar** at top — full-width pill input, filters visible tiles live
- **Icon grid** — wrapping flex row of app tiles; each tile: black rounded-square (`color` field as bg) with icon image + name label below
- **Last tile is always "+ 新增应用"** (Add New App) — a grey `+` tile always appended after real apps
- **"最小化" (Minimize)** button centred at bottom of panel
- **Right-click on any app tile** → context popup appears anchored to that tile:
  - Title: app name
  - Body: `tag` field text
  - Buttons: `🗑 删除` (Delete) | `⚙ 修改` (Edit)
  - Clicking outside dismisses it

### Add New App Modal (triggered by clicking the `+` tile)
- Light white modal card (`--modal-bg: #ffffff`) overlaid on the glass panel
- Title: **新增应用**
- Fields:
  1. **应用名称** (App Name) — text input
  2. **应用标签** (App Tag) — text input (e.g. category label)
  3. **执行路径** (Execution Path) — text input + Browse button → `pick-exe` IPC for `.exe`, or user pastes `http://` URL
  4. **背景颜色** (Background Color) — color picker → writes to `color` field; defaults `#1a1a1a`
  5. **图标上传** (Icon Upload) — file browse button → `pick-icon` IPC; preview thumbnail shown
- Buttons: **取消** (Cancel) | **完成** (Done, blue `--accent-blue`)
- On Done: validate required fields, call `save-apps`, refresh grid, close modal

### Edit App Modal (triggered by 修改 in context menu)
- Same form as Add, pre-filled with existing app data
- Title: **修改应用**

## IPC Channels (preload.js → main.js)

| Channel | Direction | Purpose |
|---|---|---|
| `open-app` | invoke | `shell.openPath(path)` |
| `open-url` | invoke | `shell.openExternal(url)` |
| `minimize-window` | send | `mainWindow.minimize()` |
| `get-apps` | invoke | Read `userData/apps.json` |
| `save-apps` | invoke | Write `userData/apps.json` |
| `pick-exe` | invoke | `dialog.showOpenDialog` for `.exe` files |
| `pick-icon` | invoke | `dialog.showOpenDialog` for image files |
| `copy-icon` | invoke | Copy chosen image into `userData/icons/` |
| `get-icon-path` | invoke | Resolve `userData/icons/<filename>` to absolute path |

---

## Security Rules

- **Always** use `contextBridge.exposeInMainWorld(...)` in `preload.js`
- **Never** set `nodeIntegration: true` or `contextIsolation: false`
- **Never** pass unsanitized user input to `shell.openPath` — validate path is absolute and on local filesystem before executing
- **Never** store user icon files outside `userData/icons/` — sanitize filename, strip path traversal (`../`) in main process before writing

---

## Packaging Rules

- Target: Windows x64, NSIS installer only
- `win.icon`: `assets/cubecloud-logo-blue.png` (electron-builder auto-converts to `.ico`)
- `productName`: `智方云cubecloud`
- NSIS shortcut name: `智方云cubecloud`
- Keep native builds writing to `dist/`; the Docker build service must keep overriding its output directory to `docker-dist/` so the two delivery paths do not trample each other
- Do not build for macOS or Linux targets

---

## Code Conventions

- Renderer files: ES modules (`type: "module"` or inline `<script type="module">`) — no CommonJS `require()`
- Main process: CommonJS (`require`) — standard for Electron main
- No frontend framework (React, Vue, etc.) — plain DOM manipulation only
- No external CSS frameworks — keep the existing custom CSS variables and class names
- Async IPC calls use `async/await`, not `.then()` chains
