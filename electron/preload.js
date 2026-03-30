const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveFile: (buffer, filename, directory) =>
    ipcRenderer.invoke('save-file', { buffer, filename, directory }),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  platform: process.platform,
  isElectron: true,
});
