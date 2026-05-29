/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  shell,
  systemPreferences,
  Tray,
} = require("electron");

let overlayWindow;
let interactiveTimer;
let tray;

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function setOverlayInteractive(enabled) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  if (interactiveTimer) {
    clearTimeout(interactiveTimer);
    interactiveTimer = undefined;
  }

  overlayWindow.setFocusable(Boolean(enabled));
  overlayWindow.setIgnoreMouseEvents(!enabled, { forward: true });

  if (enabled) {
    interactiveTimer = setTimeout(() => {
      setOverlayInteractive(false);
    }, 8000);
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "display-capture") {
      callback(true);
      return;
    }
    // For "media" (microphone/camera), defer to the OS so macOS TCC registers
    // the request and adds Echo to the Microphone privacy list.
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => permission === "display-capture",
  );
});

function enableOpenAtLogin() {
  if (!app.isPackaged) {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });
}

async function requestStartupPermissions() {
  const permissions = {
    microphone: "unknown",
    micNeedsSettings: false,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    platform: process.platform,
    screen: "unknown",
    screenNeedsSettings: false,
  };

  if (process.platform === "darwin") {
    // ── Microphone ──────────────────────────────────────────────────────
    permissions.microphone = systemPreferences.getMediaAccessStatus("microphone");

    if (permissions.microphone === "not-determined") {
      // Triggers the native TCC prompt on a properly-signed build.
      const granted = await systemPreferences.askForMediaAccess("microphone").catch(() => false);
      permissions.microphone = granted
        ? "granted"
        : systemPreferences.getMediaAccessStatus("microphone");
    }

    // Once a status is "denied"/"restricted" (or an unsigned build had the TCC
    // prompt silently fail) askForMediaAccess can no longer surface a dialog —
    // the only path left is the System Settings pane, so open it for the user.
    permissions.micNeedsSettings = permissions.microphone !== "granted";

    // ── Screen recording ────────────────────────────────────────────────
    permissions.screen = systemPreferences.getMediaAccessStatus("screen");

    if (permissions.screen !== "granted") {
      await desktopCapturer
        .getSources({
          types: ["screen"],
          thumbnailSize: { width: 1, height: 1 },
        })
        .catch(() => []);
      permissions.screen = systemPreferences.getMediaAccessStatus("screen");
      permissions.screenNeedsSettings = permissions.screen !== "granted";
    }

    // Open the relevant Settings pane(s) so the user is never left stuck. The
    // screen pane is opened last so it surfaces on top when both are missing
    // (screen recording needs a manual toggle + app restart on macOS).
    if (permissions.micNeedsSettings) {
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone");
    }

    if (permissions.screenNeedsSettings) {
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    }

    return permissions;
  }

  if (process.platform === "win32") {
    // Windows has no Screen Recording gate — desktopCapturer works without it.
    permissions.screen = "granted";

    // askForMediaAccess is macOS-only; on Windows we can only read the status
    // set by Settings › Privacy › Microphone and guide the user there.
    try {
      permissions.microphone = systemPreferences.getMediaAccessStatus("microphone");
    } catch {
      permissions.microphone = "unknown";
    }

    permissions.micNeedsSettings =
      permissions.microphone === "denied" || permissions.microphone === "restricted";

    if (permissions.micNeedsSettings) {
      shell.openExternal("ms-settings:privacy-microphone");
    }

    return permissions;
  }

  return permissions;
}

function showDashboard() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.show();
  overlayWindow.focus();
  setOverlayInteractive(true);
  overlayWindow.webContents.send("echo:dashboard-command", { type: "show-dashboard" });
}

function toggleDashboard() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.show();
  overlayWindow.focus();
  setOverlayInteractive(true);
  overlayWindow.webContents.send("echo:toggle-dashboard");
}

function sendDashboardCommand(type) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.show();
  overlayWindow.focus();
  setOverlayInteractive(true);
  overlayWindow.webContents.send("echo:dashboard-command", { type });
}

function dropTestCandy() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.showInactive();
  setOverlayInteractive(false);
  overlayWindow.webContents.send("echo:drop", {
    audioClass: "Keyboard_heavy",
    audioClasses: ["Keyboard_heavy", "Speech"],
    soundMix: [
      { audioClass: "Keyboard_heavy", weight: 0.62 },
      { audioClass: "Speech", weight: 0.38 },
    ],
    wrapped: false,
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/svg+xml;utf8," +
      encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='8' x2='24' y1='7' y2='25'><stop offset='0' stop-color='#ff7fa6'/><stop offset='.55' stop-color='#f279b8'/><stop offset='1' stop-color='#9a92ff'/></linearGradient></defs><rect width='32' height='32' fill='#fff7e8'/><path fill='url(#g)' d='M16 4.8 18.2 9l4-2.9.7 5 4.8-1.1-1.3 4.8 4.6 1.5-3.9 3 3.3 3.7-4.9.6.8 5-4.6-1.9-2.5 4.4-3.2-3.9-3.2 3.9-2.5-4.4-4.6 1.9.8-5-4.9-.6 3.3-3.7-3.9-3 4.6-1.5L4.3 10l4.8 1.1.7-5 4 2.9z'/></svg>",
      ),
  );

  tray = new Tray(icon);
  tray.setToolTip("Echo");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "開啟狀態儀表板",
        click: showDashboard,
      },
      {
        label: "重新檢查權限",
        click: () => sendDashboardCommand("check-permissions"),
      },
      { type: "separator" },
      {
        label: "結束 Echo",
        click: () => app.quit(),
      },
    ]),
  );
  tray.on("click", showDashboard);
}

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
  setOverlayInteractive(false);
  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));

  overlayWindow.once("ready-to-show", () => {
    overlayWindow.showInactive();
    setOverlayInteractive(false);
    setTimeout(showDashboard, 250);
  });
}

app.on("second-instance", showDashboard);

app.on("activate", showDashboard);

app.whenReady().then(() => {
  enableOpenAtLogin();
  createOverlayWindow();
  createTray();

  globalShortcut.register("CommandOrControl+Alt+D", toggleDashboard);
  globalShortcut.register("CommandOrControl+Alt+E", dropTestCandy);

  if (process.env.ECHO_DEBUG_SHORTCUTS === "1") {
    globalShortcut.register("CommandOrControl+Alt+W", () => {
      overlayWindow?.webContents.send("echo:drop", {
        audioClass: "Sigh",
        audioClasses: ["Sigh", "Music"],
        soundMix: [
          { audioClass: "Sigh", weight: 0.72 },
          { audioClass: "Music", weight: 0.28 },
        ],
        wrapped: true,
      });
    });
  }
});

ipcMain.on("echo:interactive", (_event, enabled) => {
  setOverlayInteractive(Boolean(enabled));
});

ipcMain.on("echo:focus", () => {
  setOverlayInteractive(true);
  overlayWindow?.show();
  overlayWindow?.focus();
});

ipcMain.handle("echo:capture-screen", async () => {
  if (process.platform === "darwin" && systemPreferences.getMediaAccessStatus("screen") !== "granted") {
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    throw new Error("Echo needs Screen Recording permission before screenshots can be wrapped.");
  }

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
    setOverlayInteractive(false);
  }
});

ipcMain.handle("echo:request-startup-permissions", requestStartupPermissions);

ipcMain.handle("echo:app-version", () => app.getVersion());

ipcMain.on("echo:open-external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
