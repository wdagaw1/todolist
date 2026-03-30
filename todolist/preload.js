const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
  setAlwaysOnTop: (value) => ipcRenderer.invoke("window:set-always-on-top", value),
  getAlwaysOnTop: () => ipcRenderer.invoke("window:get-always-on-top"),
  getOpenAtLogin: () => ipcRenderer.invoke("startup:get-open-at-login"),
  setOpenAtLogin: (value) => ipcRenderer.invoke("startup:set-open-at-login", value)
});

