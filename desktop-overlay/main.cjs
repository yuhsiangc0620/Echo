/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");

let overlayWindow;

app.whenReady().then(() => {
  const { session } = require("electron");

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === "media");
});

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  overlayWindow = new BrowserWindow({
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    width,
    height,
    frame: false,
    transparent: true,
    fullscreenable: false,
    resizable: false,
    movable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    title: "Echo Candy Overlay",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));

  overlayWindow.once("ready-to-show", () => {
    overlayWindow.showInactive();
    overlayWindow.webContents.send("echo:drop", {
      audioClass: "Keyboard_heavy",
      wrapped: false,
    });
  });
}

app.whenReady().then(() => {
  createOverlayWindow();

  globalShortcut.register("CommandOrControl+Alt+E", () => {
    overlayWindow?.webContents.send("echo:drop", {
      audioClass: "Keyboard_heavy",
      wrapped: false,
    });
  });

  globalShortcut.register("CommandOrControl+Alt+W", () => {
    overlayWindow?.webContents.send("echo:drop", {
      audioClass: "Sigh",
      wrapped: true,
    });
  });

  globalShortcut.register("CommandOrControl+Alt+K", () => {
    overlayWindow?.webContents.send("echo:fast-forward", {
      audioClass: "Keyboard_heavy",
    });
  });

  globalShortcut.register("CommandOrControl+Alt+M", () => {
    overlayWindow?.webContents.send("echo:fast-forward", {
      audioClass: "Mouse_click",
    });
  });
});

ipcMain.on("echo:interactive", (_event, enabled) => {
  overlayWindow?.setIgnoreMouseEvents(!enabled, { forward: true });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
