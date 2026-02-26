const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 3000;
let mainWindow;
let serverProcess;

function waitForServer(url, retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(url, (res) => {
        resolve();
      }).on('error', () => {
        if (retries-- > 0) setTimeout(attempt, delay);
        else reject(new Error('Sunucu başlatılamadı'));
      });
    };
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    titleBarStyle: 'default',
    title: 'Emlak Ofisi Yönetimi',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT },
  });

  serverProcess.stderr.on('data', (d) => console.error('[server]', d.toString()));

  try {
    await waitForServer(`http://localhost:${PORT}`);
    createWindow();
  } catch (err) {
    console.error(err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});
