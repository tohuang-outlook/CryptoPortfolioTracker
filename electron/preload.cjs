const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  platform: "macOS",
  forecastStorage: {
    load: () => ipcRenderer.invoke("forecast-storage:load"),
    save: (value) => ipcRenderer.invoke("forecast-storage:save", value)
  }
});
