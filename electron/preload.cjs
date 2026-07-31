const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  platform: "macOS",
  forecastStorage: {
    load: () => ipcRenderer.invoke("forecast-storage:load"),
    save: (value) => ipcRenderer.invoke("forecast-storage:save", value)
  },
  microstructureStorage: {
    load: () => ipcRenderer.invoke("microstructure-storage:load"),
    save: (value) => ipcRenderer.invoke("microstructure-storage:save", value)
  },
  candleHistoryStorage: {
    load: () => ipcRenderer.invoke("candle-history-storage:load"),
    save: (value) => ipcRenderer.invoke("candle-history-storage:save", value)
  }
});
