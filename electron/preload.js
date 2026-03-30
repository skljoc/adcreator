const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (buffer, filename) =>
    ipcRenderer.invoke('save-file', { buffer, filename }),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  platform: process.platform,
  isElectron: true,
});
