const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");

let mainWindow;
let serverProcess;
let _autoUpdater = null;
let updateCheckInProgress = false;

const PORT = 3099;
const isDev = !app.isPackaged;

function getAutoUpdater() {
  if (!_autoUpdater) {
    _autoUpdater = require("electron-updater").autoUpdater;
  }
  return _autoUpdater;
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "app-config.json");
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(data) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), "utf-8");
}

function getDataDir() {
  const config = readConfig();
  if (config.dataDir && fs.existsSync(config.dataDir)) {
    return config.dataDir;
  }
  return path.join(app.getPath("userData"), "data");
}

function ensureDataDir(dataDir) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const testDir = path.join(dataDir, "test");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
}

function getStandaloneDir() {
  const appRoot = app.getAppPath();
  // When asar is used, asarUnpack files live in app.asar.unpacked alongside app.asar
  const unpackedRoot = appRoot.replace("app.asar", "app.asar.unpacked");
  return path.join(unpackedRoot, ".next", "standalone");
}

function startNextServer() {
  const standaloneDir = getStandaloneDir();
  const serverScript = path.join(standaloneDir, "server.js");
  const dataDir = getDataDir();
  ensureDataDir(dataDir);

  serverProcess = fork(serverScript, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
    },
    silent: true,
  });

  serverProcess.stderr.on("data", (data) => {
    console.error("[Next.js]", data.toString());
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Next.js server failed to start within 30s")),
      30000
    );

    serverProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      if (msg.toLowerCase().includes("ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function killServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", status);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    try {
      await startNextServer();
    } catch (err) {
      console.error("Failed to start Next.js server:", err);
    }
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }
}

// ── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("check-for-updates", async () => {
  if (isDev) {
    sendUpdateStatus({ type: "not-available" });
    return;
  }
  await triggerUpdateCheck();
});

ipcMain.handle("install-update", () => {
  if (isDev) return;
  killServer();
  getAutoUpdater().quitAndInstall(true, true);
});

ipcMain.handle("get-data-directory", () => {
  return getDataDir();
});

ipcMain.handle("select-data-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Data Directory",
    buttonLabel: "Use This Folder",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const selected = result.filePaths[0];
  const config = readConfig();
  config.dataDir = selected;
  writeConfig(config);
  return selected;
});

// ── App lifecycle ────────────────────────────────────────────────────────────

async function triggerUpdateCheck() {
  if (updateCheckInProgress) return;
  updateCheckInProgress = true;
  try {
    await getAutoUpdater().checkForUpdates();
  } catch (err) {
    sendUpdateStatus({ type: "error", message: err.message });
  } finally {
    updateCheckInProgress = false;
  }
}

function setupAutoUpdater() {
  const updater = getAutoUpdater();
  updater.on("checking-for-update", () =>
    sendUpdateStatus({ type: "checking" })
  );
  updater.on("update-available", (info) =>
    sendUpdateStatus({ type: "available", version: info.version })
  );
  updater.on("update-not-available", () =>
    sendUpdateStatus({ type: "not-available" })
  );
  updater.on("download-progress", (progress) =>
    sendUpdateStatus({ type: "downloading", percent: Math.round(progress.percent) })
  );
  updater.on("update-downloaded", (info) =>
    sendUpdateStatus({ type: "downloaded", version: info.version })
  );
  updater.on("error", (err) =>
    sendUpdateStatus({ type: "error", message: err.message })
  );
}

app.whenReady().then(() => {
  createWindow();

  if (!isDev) {
    setupAutoUpdater();
    triggerUpdateCheck();
  }
});

app.on("window-all-closed", () => {
  killServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  killServer();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
