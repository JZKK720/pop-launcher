const {
  app, BrowserWindow, ipcMain, shell, dialog,
  Tray, Menu, nativeImage, protocol, screen
} = require('electron');
const path = require('path');
const fs   = require('fs');

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cubecloud',
    privileges: { standard: true, secure: true, bypassCSP: true, supportFetchAPI: true, corsEnabled: false }
  }
]);

const runtimeSessionDataPath = path.join(app.getPath('temp'), 'cubecloud-session', String(process.pid));
fs.mkdirSync(runtimeSessionDataPath, { recursive: true });
app.setPath('sessionData', runtimeSessionDataPath);

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;
let tray       = null;

const WINDOW_LAYOUTS = {
  compact: {
    width: 364,
    height: 84,
    minWidth: 364,
    minHeight: 84
  },
  workspace: {
    width: 1380,
    height: 820,
    minWidth: 1100,
    minHeight: 620
  }
};

const WINDOW_BOTTOM_GAP = 12;
let currentLayoutMode = 'compact';

const userDataAppsPath = () => path.join(app.getPath('userData'), 'apps.json');
const userDataIconsDir = () => path.join(app.getPath('userData'), 'icons');
const uiStatePath      = () => path.join(app.getPath('userData'), 'ui-state.json');
const bundledAppsPath  = path.join(__dirname, 'src', 'renderer', 'apps.json');
const bundledIconsDir  = path.join(__dirname, 'src', 'renderer', 'icons');
const appIconPath      = path.join(__dirname, 'assets', 'cubecloud-app-icon.png');

// ── Seed userData on first launch ─────────────────────────────────────────────
const OLD_DEFAULT_COLORS = new Set(['#1a1a1a', '#2a2a2a', '#1e3a8a', '#2d4fb8']);

function seedUserData() {
  const iconsDir = userDataIconsDir();
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  if (!fs.existsSync(userDataAppsPath())) {
    fs.copyFileSync(bundledAppsPath, userDataAppsPath());

    if (fs.existsSync(bundledIconsDir)) {
      for (const file of fs.readdirSync(bundledIconsDir)) {
        const src  = path.join(bundledIconsDir, file);
        const dest = path.join(iconsDir, file);
        if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
      }
    }
  } else {
    // Migrate: clear old hardcoded default colors so tiles use the glass CSS default
    try {
      const apps = JSON.parse(fs.readFileSync(userDataAppsPath(), 'utf8'));
      let changed = false;
      for (const a of apps) {
        if (OLD_DEFAULT_COLORS.has(a.color)) { a.color = ''; changed = true; }
      }
      if (changed) fs.writeFileSync(userDataAppsPath(), JSON.stringify(apps, null, 2), 'utf8');
    } catch { /* best-effort */ }
  }
}

function readUiState() {
  try {
    return JSON.parse(fs.readFileSync(uiStatePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeUiState(nextState) {
  const currentState = readUiState();
  fs.writeFileSync(uiStatePath(), JSON.stringify({ ...currentState, ...nextState }, null, 2), 'utf8');
}

function getLayoutPreset(mode = currentLayoutMode) {
  return WINDOW_LAYOUTS[mode] || WINDOW_LAYOUTS.compact;
}

function getAnchoredBounds(mode, referenceBounds) {
  const preset = getLayoutPreset(mode);
  const display = screen.getDisplayMatching(referenceBounds || screen.getPrimaryDisplay().bounds);
  const workArea = display.workArea;

  const width = Math.max(
    Math.min(preset.width, workArea.width - 24),
    Math.min(preset.minWidth, workArea.width)
  );
  const height = Math.max(
    Math.min(preset.height, workArea.height - 24),
    Math.min(preset.minHeight, workArea.height)
  );

  const x = Math.round(workArea.x + ((workArea.width - width) / 2));
  const y = Math.round(workArea.y + workArea.height - height - WINDOW_BOTTOM_GAP);
  return { x, y, width, height };
}

function syncRendererLayoutMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('window-layout-changed', currentLayoutMode);
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const initialBounds = getAnchoredBounds(currentLayoutMode);

  mainWindow = new BrowserWindow({
    x:           initialBounds.x,
    y:           initialBounds.y,
    width:       initialBounds.width,
    height:      initialBounds.height,
    minWidth:    WINDOW_LAYOUTS.compact.minWidth,
    minHeight:   WINDOW_LAYOUTS.compact.minHeight,
    transparent: true,
    frame:       false,
    resizable:   true,
    skipTaskbar: false,
    show:        false,
    icon:        appIconPath,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    applyWindowLayout(currentLayoutMode, { persist: false, animate: false });
    mainWindow.show();
    syncRendererLayoutMode();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function applyWindowLayout(mode, options = {}) {
  if (!mainWindow) return;

  const { persist = true, animate = true } = options;
  const nextMode = WINDOW_LAYOUTS[mode] ? mode : 'compact';
  currentLayoutMode = nextMode;

  const bounds = getAnchoredBounds(nextMode, mainWindow.getBounds());
  mainWindow.setBounds(bounds, animate);
  mainWindow.setMinimumSize(
    WINDOW_LAYOUTS.compact.minWidth,
    WINDOW_LAYOUTS.compact.minHeight
  );

  if (persist) writeUiState({ layoutMode: nextMode });
  syncRendererLayoutMode();
}

function showMainWindow() {
  if (!mainWindow) return;
  applyWindowLayout(currentLayoutMode, { persist: false, animate: false });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(appIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('智方云cubecloud');

  const menu = Menu.buildFromTemplate([
    { label: '打开 智方云cubecloud', click: () => { showMainWindow(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.exit(0); } }
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { showMainWindow(); });
}

// ── IPC: launch ───────────────────────────────────────────────────────────────
ipcMain.handle('open-app', async (_e, filePath) => {
  const targetPath = typeof filePath === 'string' ? filePath.trim() : '';
  if (!targetPath || /^https?:\/\//i.test(targetPath)) return 'Invalid path';
  if (!path.isAbsolute(targetPath)) return 'Not an absolute path';
  return await shell.openPath(path.normalize(targetPath)) || null;
});

ipcMain.handle('open-url', async (_e, url) => {
  if (!url || !/^https?:\/\//i.test(url)) return 'Invalid URL';
  await shell.openExternal(url);
  return null;
});

ipcMain.on('minimize-window', () => {
  mainWindow && mainWindow.minimize();
});

ipcMain.on('restore-window', () => {
  if (!mainWindow) return;
  applyWindowLayout(currentLayoutMode === 'compact' ? 'workspace' : 'compact');
});

ipcMain.on('close-window', () => {
  mainWindow && mainWindow.hide();
});

ipcMain.handle('get-window-layout', async () => currentLayoutMode);

// ── IPC: data ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-apps', async () => {
  try {
    return JSON.parse(fs.readFileSync(userDataAppsPath(), 'utf8'));
  } catch {
    return [];
  }
});

ipcMain.handle('save-apps', async (_e, apps) => {
  fs.writeFileSync(userDataAppsPath(), JSON.stringify(apps, null, 2), 'utf8');
  return true;
});

// ── IPC: file dialogs ─────────────────────────────────────────────────────────
ipcMain.handle('pick-exe', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择应用程序',
    filters: [
      { name: '可执行文件', extensions: ['exe'] },
      { name: '所有文件',   extensions: ['*']   }
    ],
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('pick-icon', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图标图片',
    filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'ico', 'svg', 'webp'] }],
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: icon management ──────────────────────────────────────────────────────
ipcMain.handle('read-icon-preview', async (_e, srcPath) => {
  try {
    const data = fs.readFileSync(srcPath);
    const ext  = path.extname(srcPath).toLowerCase().slice(1);
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                   ico: 'image/x-icon', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'image/png';
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch { return null; }
});

ipcMain.handle('copy-icon', async (_e, srcPath) => {
  if (!srcPath) return null;
  // Sanitize filename — strip path traversal and non-safe chars
  const filename = path.basename(srcPath).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const dest = path.join(userDataIconsDir(), filename);
  fs.copyFileSync(srcPath, dest);
  return 'icons/' + filename;
});

ipcMain.handle('get-icon-path', async (_e, relativePath) => {
  if (!relativePath) return null;
  // Resolve to an absolute path and confirm it stays within userData
  const userData = app.getPath('userData');
  const fullPath = path.resolve(userData, relativePath);
  if (!fullPath.startsWith(userData + path.sep) && fullPath !== userData) return null;
  try {
    const data = fs.readFileSync(fullPath);
    const ext  = path.extname(fullPath).toLowerCase().slice(1);
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                   ico: 'image/x-icon', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'image/png';
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch { return null; }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Serve userData files via cubecloud:// protocol (fs-based, no net.fetch issues on Windows)
  protocol.handle('cubecloud', (request) => {
    const url          = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const safe         = relativePath.replace(/\.\./g, '');
    const fullPath     = path.join(app.getPath('userData'), safe);
    try {
      const data = fs.readFileSync(fullPath);
      const ext  = path.extname(fullPath).toLowerCase();
      const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                     '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
      return new Response(data, { headers: { 'Content-Type': mime[ext] || 'application/octet-stream' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  seedUserData();
  currentLayoutMode = readUiState().layoutMode === 'workspace' ? 'workspace' : 'compact';
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // keep running in tray
});

app.on('before-quit', () => {
  if (mainWindow) mainWindow.removeAllListeners('close');
});
