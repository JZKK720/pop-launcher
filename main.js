const {
  app, BrowserWindow, ipcMain, shell, dialog,
  Tray, Menu, nativeImage, protocol
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

let mainWindow = null;
let tray       = null;

const userDataAppsPath = () => path.join(app.getPath('userData'), 'apps.json');
const userDataIconsDir = () => path.join(app.getPath('userData'), 'icons');
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

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:       1060,
    height:      620,
    transparent: true,
    frame:       false,
    resizable:   false,
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

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(appIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('智方云cubecloud');

  const menu = Menu.buildFromTemplate([
    { label: '打开 智方云cubecloud', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.exit(0); } }
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── IPC: launch ───────────────────────────────────────────────────────────────
ipcMain.handle('open-app', async (_e, filePath) => {
  if (!filePath || /^https?:\/\//i.test(filePath)) return 'Invalid path';
  const resolved = path.resolve(filePath);
  if (!path.isAbsolute(resolved)) return 'Not an absolute path';
  return await shell.openPath(resolved) || null;
});

ipcMain.handle('open-url', async (_e, url) => {
  if (!url || !/^https?:\/\//i.test(url)) return 'Invalid URL';
  await shell.openExternal(url);
  return null;
});

ipcMain.on('minimize-window', () => {
  mainWindow && mainWindow.minimize();
});

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
  // Strip traversal attempts
  const safe     = relativePath.replace(/\.\./g, '').replace(/^[/\\]+/, '');
  const fullPath = path.join(app.getPath('userData'), safe);
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
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // keep running in tray
});

app.on('before-quit', () => {
  if (mainWindow) mainWindow.removeAllListeners('close');
});
