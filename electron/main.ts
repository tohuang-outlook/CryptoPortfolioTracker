import { app, BrowserWindow, ipcMain } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { runForecastUpdate } from "./forecastUpdate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const preloadPath = path.join(__dirname, "../../electron/preload.cjs");
const rendererHtmlPath = path.join(__dirname, "../../dist/index.html");
const forecastFileName = "bitcoin-forecast-records.json";
const launchAgentLabel = "com.tonyhuang.cryptoportfoliotracker.forecast";

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 820,
    backgroundColor: "#edf5f3",
    title: "Crypto Portfolio Tracker",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev && rendererUrl) {
    void window.loadURL(rendererUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void window.loadFile(rendererHtmlPath);
}

app.whenReady().then(async () => {
  if (process.argv.includes("--run-forecast-update")) {
    try {
      await runForecastUpdate(app.getPath("userData"));
    } finally {
      app.quit();
    }
    return;
  }

  registerForecastStorageIpc();
  await registerForecastLaunchAgent();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerForecastStorageIpc() {
  ipcMain.handle("forecast-storage:load", async () => {
    try {
      return await readFile(getForecastFilePath(), "utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("forecast-storage:save", async (_event, value: unknown) => {
    if (typeof value !== "string") {
      throw new Error("Forecast storage accepts serialized records only.");
    }

    const filePath = getForecastFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    await writeFile(temporaryPath, value, "utf8");
    await rename(temporaryPath, filePath);
  });
}

function getForecastFilePath() {
  return path.join(app.getPath("userData"), forecastFileName);
}

async function registerForecastLaunchAgent() {
  if (!app.isPackaged) return;

  const launchAgentsPath = path.join(os.homedir(), "Library", "LaunchAgents");
  const launchAgentPath = path.join(launchAgentsPath, `${launchAgentLabel}.plist`);
  const logPath = path.join(app.getPath("userData"), "forecast-background.log");
  const executablePath = process.execPath;
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${launchAgentLabel}</string>
<key>ProgramArguments</key><array><string>${executablePath}</string><string>--run-forecast-update</string></array>
<key>StartInterval</key><integer>3600</integer>
<key>StandardOutPath</key><string>${logPath}</string>
<key>StandardErrorPath</key><string>${logPath}</string>
</dict></plist>`;

  await mkdir(launchAgentsPath, { recursive: true });
  await writeFile(launchAgentPath, plist, "utf8");

  const domain = `gui/${os.userInfo().uid}`;
  spawnSync("launchctl", ["bootout", domain, launchAgentPath], { stdio: "ignore" });
  spawnSync("launchctl", ["bootstrap", domain, launchAgentPath], { stdio: "ignore" });
}
