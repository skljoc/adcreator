const { app, BrowserWindow, session, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Set COOP/COEP headers for FFmpeg.wasm SharedArrayBuffer support
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    });
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const { machineIdSync } = require('node-machine-id');
const os = require('os');

// IPC: Save exported video file via native dialog
ipcMain.handle('save-file', async (event, { buffer, filename }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, Buffer.from(buffer));
    return { success: true, path: result.filePath };
  }
  return { success: false };
});

// IPC: Get hardware machine ID for licensing
ipcMain.handle('get-machine-id', () => {
  try {
    return machineIdSync();
  } catch (e) {
    console.error('Failed to get machine ID:', e);
    return 'fallback-id-error';
  }
});

// IPC: Get OS metadata
ipcMain.handle('get-device-info', () => {
  try {
    const isMacBook = os.hostname().toLowerCase().includes('book') || os.cpus()[0].model.toLowerCase().includes('book');
    return {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      username: os.userInfo().username,
      hostname: os.hostname(),
      cpu: os.cpus()[0].model,
      device_type: isMacBook ? 'Laptop' : 'Desktop/Unknown'
    };
  } catch (e) {
    console.error('Failed to get device info:', e);
    return { error: e.message };
  }
});
