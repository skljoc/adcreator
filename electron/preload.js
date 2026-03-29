const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (buffer, filename) =>
    ipcRenderer.invoke('save-file', { buffer, filename }),
  platform: process.platform,
  isElectron: true,
});
