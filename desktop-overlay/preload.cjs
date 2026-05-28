/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("echoOverlay", {
  apiBaseUrl: process.env.ECHO_API_BASE_URL || "https://echo-gamma-two.vercel.app",
  userId: process.env.ECHO_USER_ID || "",
  deviceId: process.env.ECHO_DEVICE_ID || "desktop-overlay-dev",
  onDrop(callback) {
    ipcRenderer.on("echo:drop", (_event, payload) => callback(payload));
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
});
