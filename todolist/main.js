const { app, BrowserWindow, ipcMain, nativeTheme, screen } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow = null;
let appState = loadState();

// Desktop overlay default + minimum sizes.
// (If we restore too small bounds from previous runs, the calendar will look "cut off".)
const DEFAULT_BOUNDS = {
  width: 560,
  height: 720,
};

const MIN_BOUNDS = {
  width: 520,
  height: 640,
};

const STATE_FILE = path.join(app.getPath("userData"), "state.json");

function loadState() {
  try {
    const raw = fs.readFileSync(path.join(app.getPath("userData"), "state.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(next) {
  appState = next;
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(appState, null, 2), "utf8");
  } catch {
    // ignore
  }
}

function clampBoundsToWorkArea(bounds) {
  const widthRaw = Number.isFinite(bounds?.width) ? bounds.width : DEFAULT_BOUNDS.width;
  const heightRaw = Number.isFinite(bounds?.height) ? bounds.height : DEFAULT_BOUNDS.height;
  const width = Math.max(widthRaw, MIN_BOUNDS.width);
  const height = Math.max(heightRaw, MIN_BOUNDS.height);
  const display = screen.getDisplayNearestPoint({
    x: Number.isFinite(bounds?.x) ? bounds.x : screen.getPrimaryDisplay().bounds.x,
    y: Number.isFinite(bounds?.y) ? bounds.y : screen.getPrimaryDisplay().bounds.y,
  });

  const workArea = display.workArea;
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  const x = Number.isFinite(bounds?.x) ? bounds.x : workArea.x + workArea.width - width - 16;
  const y = Number.isFinite(bounds?.y) ? bounds.y : workArea.y + 16;

  return {
    x: Math.max(workArea.x, Math.min(x, maxX)),
    y: Math.max(workArea.y, Math.min(y, maxY)),
    width,
    height,
  };
}

function createWindow() {
  const pinned = appState?.pinned ?? true;
  const bounds = clampBoundsToWorkArea(appState?.bounds ?? {});

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: Boolean(pinned),
    skipTaskbar: true,
    // Keep it interactive even when it's an always-on-top desktop overlay.
    focusable: true,
    resizable: false,
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Keep a consistent always-on-top level (important for "desktop overlay" feel).
  win.setAlwaysOnTop(Boolean(pinned), "screen-saver");

  // Nice default: match system dark/light, but we design for dark.
  nativeTheme.themeSource = "system";

  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "index.html"));

  // Keep position "attached" to the desktop.
  win.on("move", () => {
    try {
      saveState({ ...appState, bounds: win.getBounds() });
    } catch {
      // ignore
    }
  });

  return win;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    // Since `focusable:false`, just ensure it's visible.
    if (!mainWindow.isVisible()) mainWindow.show();
  });
}

app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on("window-all-closed", () => {
  // Keep default behavior on Windows/Linux.
  app.quit();
});

ipcMain.handle("window:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window:close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("window:set-always-on-top", (_e, value) => {
  if (!mainWindow) return false;
  const enabled = Boolean(value);
  mainWindow.setAlwaysOnTop(enabled, "screen-saver");
  saveState({ ...appState, pinned: enabled });
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle("window:get-always-on-top", () => {
  if (!mainWindow) return false;
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle("startup:get-open-at-login", () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("startup:set-open-at-login", (_e, value) => {
  const enabled = Boolean(value);
  try {
    app.setLoginItemSettings({ openAtLogin: enabled });
  } catch {
    // ignore
  }
  return app.getLoginItemSettings().openAtLogin;
});

