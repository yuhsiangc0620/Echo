/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("echoOverlay", {
  apiBaseUrl: process.env.ECHO_API_BASE_URL || "https://echo-gamma-two.vercel.app",
  userId: process.env.ECHO_USER_ID || "",
  deviceId: process.env.ECHO_DEVICE_ID || "desktop-overlay-dev",
  onDrop(callback) {
    ipcRenderer.on("echo:drop", (_event, payload) => callback(payload));
  },
  onToggleDashboard(callback) {
    ipcRenderer.on("echo:toggle-dashboard", () => callback());
  },
  onDashboardCommand(callback) {
    ipcRenderer.on("echo:dashboard-command", (_event, payload) => callback(payload));
  },
  focus() {
    ipcRenderer.send("echo:focus");
  },
  setInteractive(enabled) {
    ipcRenderer.send("echo:interactive", enabled);
  },
  captureScreen() {
    return ipcRenderer.invoke("echo:capture-screen");
  },
  requestStartupPermissions() {
    return ipcRenderer.invoke("echo:request-startup-permissions");
  },
  getAppVersion() {
    return ipcRenderer.invoke("echo:app-version");
  },
  downloadUpdate(url) {
    return ipcRenderer.invoke("echo:download-update", { url });
  },
  openExternal(url) {
    ipcRenderer.send("echo:open-external", url);
  },
  spawnCandy(payload) {
    ipcRenderer.send("echo:spawn-candy", payload);
  },
  setScreenCapture(enabled) {
    ipcRenderer.send("echo:set-screen-capture", enabled);
  },
  onSetScreenCapture(callback) {
    ipcRenderer.on("echo:set-screen-capture", (_event, enabled) => callback(enabled));
  },
  hideDashboard() {
    ipcRenderer.send("echo:hide-dashboard");
  },
  platform: process.platform,
});
