# Mac Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing Crypto Portfolio Tracker as a universal unsigned macOS desktop app that can be shared as a `.dmg` installer.

**Architecture:** Keep the current React + Vite app as the renderer and add a thin Electron shell with a preload layer. Use `electron-builder` to package the compiled renderer plus Electron entry files into a universal macOS `.dmg`, while preserving the existing portfolio logic and local storage behavior.

**Tech Stack:** React 19, Vite, TypeScript, Electron, electron-builder, electron-vite-style dev workflow with concurrent local processes

---

## File Structure

- Create: `electron/main.ts`
  - Electron main process that creates the macOS app window and loads either the Vite dev server or built renderer files.
- Create: `electron/preload.ts`
  - Minimal preload layer with context isolation enabled and no direct Node access exposed to the renderer.
- Create: `tsconfig.electron.json`
  - TypeScript config for compiling Electron entry files into a separate output directory.
- Create: `scripts/launch-electron.mjs`
  - Small Node helper that waits for the Vite dev server and launches Electron for local desktop development.
- Modify: `package.json`
  - Add Electron dependencies, desktop scripts, and builder configuration for universal macOS packaging.
- Modify: `README.md`
  - Document how to install dependencies, run the desktop app locally, build the `.dmg`, and open the unsigned test build.
- Modify: `src/App.test.tsx`
  - Add a targeted regression test proving the renderer still boots when desktop packaging changes do not alter app UI expectations.

### Task 1: Add Failing Desktop Packaging Coverage

**Files:**
- Modify: `package.json`
- Create: `README.md`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing renderer safety test**

```tsx
test("renders the portfolio tracker heading", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /crypto portfolio tracker/i })
  ).toBeInTheDocument();
});
```

This test already exists in `src/App.test.tsx`. Keep it as the baseline regression guard and do not remove it while adding desktop packaging support.

- [ ] **Step 2: Add desktop packaging placeholders to `package.json`**

Add the desktop scripts first, before installing dependencies, so the next command failure confirms the project does not yet know how to run Electron:

```json
{
  "scripts": {
    "desktop:dev": "node scripts/launch-electron.mjs",
    "desktop:build": "npm run build && tsc -p tsconfig.electron.json && electron-builder --mac dmg"
  }
}
```

- [ ] **Step 3: Run the desktop build command to verify it fails**

Run: `npm run desktop:build`

Expected: FAIL because `scripts/launch-electron.mjs`, `tsconfig.electron.json`, and the Electron dependencies do not exist yet.

- [ ] **Step 4: Revert the temporary placeholder-only edits if needed**

Keep the repo in a clean intermediate state before adding the real implementation. If the placeholder scripts were added in a separate edit, replace them immediately with the real scripts during Task 2 instead of leaving broken package metadata behind.

- [ ] **Step 5: Commit**

Do not commit at the end of this task. The expected failure is only a checkpoint and should roll directly into the implementation tasks below.

### Task 2: Add The Electron Runtime Shell

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `tsconfig.electron.json`

- [ ] **Step 1: Write the failing Electron typecheck command**

Run: `npx tsc -p tsconfig.electron.json`

Expected: FAIL because `tsconfig.electron.json` does not exist yet.

- [ ] **Step 2: Create `tsconfig.electron.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "electron-dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["electron/**/*.ts"]
}
```

- [ ] **Step 3: Create `electron/preload.ts`**

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("desktopApp", {
  platform: "macOS"
});
```

- [ ] **Step 4: Create `electron/main.ts`**

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const preloadPath = path.join(__dirname, "preload.js");
const rendererHtmlPath = path.join(__dirname, "../dist/index.html");

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

app.whenReady().then(() => {
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
```

- [ ] **Step 5: Run the Electron typecheck to verify it reaches dependency errors**

Run: `npx tsc -p tsconfig.electron.json`

Expected: FAIL because Electron and Node typings are not fully installed/configured yet.

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts electron/preload.ts tsconfig.electron.json
git commit -m "feat: add Electron runtime shell"
```

### Task 3: Wire Electron Into The Project Tooling

**Files:**
- Modify: `package.json`
- Create: `scripts/launch-electron.mjs`

- [ ] **Step 1: Write the failing desktop dev script invocation**

Run: `npm run desktop:dev`

Expected: FAIL because the helper launcher and Electron dependencies are still missing.

- [ ] **Step 2: Install the required desktop dependencies**

Run:

```bash
npm install -D electron electron-builder wait-on concurrently @types/node
```

Expected: PASS with lockfile updates and new dev dependencies.

- [ ] **Step 3: Update `package.json` with real desktop scripts and builder config**

```json
{
  "main": "electron-dist/electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "electron:compile": "tsc -p tsconfig.electron.json",
    "desktop:dev": "concurrently -k \"vite\" \"wait-on tcp:5173 && node scripts/launch-electron.mjs\"",
    "desktop:build": "npm run build && npm run electron:compile && electron-builder --mac dmg"
  },
  "build": {
    "appId": "com.tonyhuang.cryptoportfoliotracker",
    "productName": "Crypto Portfolio Tracker",
    "files": [
      "dist/**/*",
      "electron-dist/**/*",
      "package.json"
    ],
    "mac": {
      "target": [
        {
          "target": "dmg",
          "arch": ["universal"]
        }
      ],
      "category": "public.app-category.finance"
    }
  }
}
```

- [ ] **Step 4: Create `scripts/launch-electron.mjs`**

```js
import { spawn } from "node:child_process";
import process from "node:process";

const child = spawn(
  "npx",
  ["electron", "."],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "http://127.0.0.1:5173"
    }
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
```

- [ ] **Step 5: Run the Electron compile command**

Run: `npm run electron:compile`

Expected: PASS and emit compiled Electron files under `electron-dist/`.

- [ ] **Step 6: Run the desktop dev command**

Run: `npm run desktop:dev`

Expected: PASS and open the Electron shell pointed at the Vite renderer.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/launch-electron.mjs
git commit -m "feat: add desktop packaging scripts"
```

### Task 4: Document The macOS Distribution Workflow

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the failing docs lookup checkpoint**

Run: `test -f README.md && echo present || echo missing`

Expected: `missing`

- [ ] **Step 2: Create `README.md`**

```md
# Crypto Portfolio Tracker

Crypto Portfolio Tracker is a calm, friendly desktop-first portfolio tracker for everyday crypto investors.

## Requirements

- Node.js 20+
- npm
- macOS for desktop packaging

## Install

```bash
npm install
```

## Web Development

```bash
npm run dev
```

## Desktop Development

```bash
npm run desktop:dev
```

## Build Web App

```bash
npm run build
```

## Build macOS DMG

```bash
npm run desktop:build
```

The packaged output will be written to `dist/` and the Electron builder output directory.

## Opening The Unsigned Test Build

Because this first desktop release is unsigned, macOS may block it the first time:

1. Open the `.dmg`
2. Drag the app into Applications
3. Right-click the app and choose `Open`
4. Confirm the security prompt

If macOS still blocks launch, open `System Settings > Privacy & Security` and allow the app to open.
```

- [ ] **Step 3: Verify the README references the final scripts**

Run: `rg -n "desktop:dev|desktop:build|Right-click" README.md`

Expected: PASS with all three lines present.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add desktop app usage guide"
```

### Task 5: Full Verification And Packaging

**Files:**
- Verify: `package.json`
- Verify: `electron/main.ts`
- Verify: `electron/preload.ts`
- Verify: `README.md`
- Verify: `src/App.test.tsx`

- [ ] **Step 1: Run the renderer test suite**

Run: `npm test -- --run`

Expected: PASS with all existing application tests still green.

- [ ] **Step 2: Run the web build**

Run: `npm run build`

Expected: PASS and emit the Vite production bundle under `dist/`.

- [ ] **Step 3: Run the Electron compile step**

Run: `npm run electron:compile`

Expected: PASS and emit the compiled Electron entry files under `electron-dist/`.

- [ ] **Step 4: Run the desktop packaging build**

Run: `npm run desktop:build`

Expected: PASS and generate a universal macOS `.dmg`.

- [ ] **Step 5: Launch the packaged app locally**

Open the generated `.app` or mounted `.dmg` output locally and confirm:

- the main window opens
- the dashboard renders
- adding a transaction still works
- existing local data still loads

- [ ] **Step 6: Review git status for generated artifacts**

Run: `git status --short`

Expected: Source changes only. Ignore or clean generated packaging output before the final commit if those files are not meant to be tracked.

- [ ] **Step 7: Commit**

```bash
git add electron/main.ts electron/preload.ts tsconfig.electron.json scripts/launch-electron.mjs package.json package-lock.json README.md
git commit -m "feat: package app as unsigned universal Mac desktop build"
```

## Self-Review

- Spec coverage:
  - Electron shell: covered in Tasks 2 and 3
  - universal `.dmg`: covered in Tasks 3 and 5
  - unsigned test build instructions: covered in Task 4
  - keep renderer behavior unchanged: covered by Tasks 1 and 5
- Placeholder scan:
  - No `TODO`, `TBD`, or “similar to” placeholders remain
- Type consistency:
  - `desktop:dev`, `desktop:build`, and `electron:compile` are named consistently across all tasks
