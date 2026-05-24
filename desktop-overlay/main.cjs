/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } = require("electron");

let overlayWindow;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  overlayWindow?.setFocusable(Boolean(enabled));
  overlayWindow?.setIgnoreMouseEvents(!enabled, { forward: true });
});

ipcMain.on("echo:focus", () => {
  overlayWindow?.setFocusable(true);
  overlayWindow?.setIgnoreMouseEvents(false, { forward: true });
  overlayWindow?.show();
  overlayWindow?.focus();
});

ipcMain.handle("echo:capture-screen", async () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const scaleFactor = primaryDisplay.scaleFactor || 1;
  const width = Math.round(primaryDisplay.bounds.width * scaleFactor);
  const height = Math.round(primaryDisplay.bounds.height * scaleFactor);

  overlayWindow?.hide();
  await wait(140);

  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
    });
    const displayId = String(primaryDisplay.id);
    const source = sources.find((candidate) => candidate.display_id === displayId) || sources[0];

    if (!source) {
      throw new Error("No screen source available");
    }

    const size = source.thumbnail.getSize();

    return {
      dataUrl: source.thumbnail.toDataURL(),
      width: size.width,
      height: size.height,
    };
  } finally {
    overlayWindow?.showInactive();
    overlayWindow?.setAlwaysOnTop(true, "screen-saver");
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
