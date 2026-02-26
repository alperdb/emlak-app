const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const http = require('http');

const PORT = process.env.PORT || 3000;

// ── DB yolu: paketlenmiş modda yazılabilir userData klasörü ──────────────────
function resolveDbPath() {
  if (app.isPackaged) {
    const userDataDb = path.join(app.getPath('userData'), 'emlak.db');
    if (!fs.existsSync(userDataDb)) {
      // İlk çalıştırmada şablonu kopyala
      const templateDb = path.join(process.resourcesPath, 'emlak.db');
      if (fs.existsSync(templateDb)) {
        fs.copyFileSync(templateDb, userDataDb);
      }
    }
    return userDataDb;
  }
  return path.join(__dirname, '..', 'emlak.db');
}

process.env.DB_PATH = resolveDbPath();
process.env.PORT    = String(PORT);

// ── Express sunucusunu aynı process içinde başlat ────────────────────────────
require('../server');

// ── Sunucu hazır olana kadar bekle ───────────────────────────────────────────
function waitForServer(retries = 40, delay = 300) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`http://localhost:${PORT}`, () => {
        resolve();
      }).on('error', () => {
        if (retries-- > 0) setTimeout(attempt, delay);
        else reject(new Error(`localhost:${PORT} dinlemiyor`));
      });
      req.end();
    };
    attempt();
  });
}

// ── BrowserWindow ────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Emlak Ofisi Yönetimi',
    show: false,
    backgroundColor: '#f8fafc',
  });

  win.loadURL(`http://localhost:${PORT}`);
  win.once('ready-to-show', () => win.show());

  // Harici linkleri tarayıcıda aç
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Geliştirme ortamında DevTools
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.key === 'F12') win.webContents.toggleDevTools();
    });
  }
}

app.whenReady().then(async () => {
  try {
    await waitForServer();
    createWindow();
  } catch (err) {
    console.error('[electron]', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
