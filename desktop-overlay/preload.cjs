/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("echoOverlay", {
  onDrop(callback) {
    ipcRenderer.on("echo:drop", (_event, payload) => callback(payload));
  },
  onFastForward(callback) {
    ipcRenderer.on("echo:fast-forward", (_event, payload) => callback(payload));
  },
  setInteractive(enabled) {
    ipcRenderer.send("echo:interactive", enabled);
  },
});
