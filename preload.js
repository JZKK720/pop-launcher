const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openApp:          (filePath)     => ipcRenderer.invoke('open-app',          filePath),
  openUrl:          (url)          => ipcRenderer.invoke('open-url',           url),
  minimizeWindow:   ()             => ipcRenderer.send('minimize-window'),
  restoreWindow:    ()             => ipcRenderer.send('restore-window'),
  closeWindow:      ()             => ipcRenderer.send('close-window'),
  getWindowLayout:  ()             => ipcRenderer.invoke('get-window-layout'),
  getApps:          ()             => ipcRenderer.invoke('get-apps'),
  saveApps:         (apps)         => ipcRenderer.invoke('save-apps',          apps),
  pickExe:          ()             => ipcRenderer.invoke('pick-exe'),
  pickIcon:         ()             => ipcRenderer.invoke('pick-icon'),
  copyIcon:         (srcPath)      => ipcRenderer.invoke('copy-icon',          srcPath),
  getIconPath:      (relativePath) => ipcRenderer.invoke('get-icon-path',      relativePath),
  readIconPreview:  (srcPath)      => ipcRenderer.invoke('read-icon-preview',  srcPath),
  onWindowLayoutChanged: (listener) => {
    const wrapped = (_event, layoutMode) => listener(layoutMode);
    ipcRenderer.on('window-layout-changed', wrapped);
    return () => ipcRenderer.removeListener('window-layout-changed', wrapped);
  }
});
