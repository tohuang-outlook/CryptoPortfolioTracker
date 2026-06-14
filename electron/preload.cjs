const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  platform: "macOS"
});
