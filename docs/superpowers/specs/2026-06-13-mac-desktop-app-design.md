# Mac Desktop App Design

## Summary

This update packages the existing Crypto Portfolio Tracker web app as a macOS desktop application so it can be shared as a downloadable installer instead of only running in the browser.

The first release target is a universal Mac test build for both Apple Silicon and Intel Macs. It should produce a `.dmg` installer that opens the existing React app inside a native desktop window. This first version does not include Apple code signing or notarization, so macOS may show security warnings during installation or first launch.

## Goals

- Reuse the current React + Vite application without rewriting the UI in native macOS frameworks.
- Run the app in a native desktop window on macOS.
- Build a universal macOS app that supports Apple Silicon and Intel.
- Produce a shareable `.dmg` installer for test distribution.
- Keep the current local-storage-based portfolio behavior working inside the desktop app.

## Non-Goals

- Apple Developer signing or notarization.
- Auto-update support.
- Native menu bar features, dock integrations, or background processes.
- Windows or Linux desktop packaging.
- Moving data storage out of browser-style local storage for this first release.

## Recommended Approach

Use Electron as the desktop shell and `electron-builder` for packaging.

Why this approach:

- The current app is already a client-side React/Vite app, so Electron can host it with minimal rework.
- Electron packaging for `.app` and `.dmg` is mature and well documented.
- A universal build is directly supported by the packaging toolchain.
- It keeps the first deliverable focused on packaging and distribution instead of framework migration.

## Architecture

### Renderer

The existing React application remains the renderer UI. The same `src/` app code should continue to own:

- portfolio dashboard rendering
- transaction entry and editing
- local state and local storage persistence
- price loading and display

No business logic should move into Electron for this release.

### Main Process

Add a small Electron main process that is responsible for:

- creating the desktop window
- loading the Vite dev server during development
- loading the built static `dist/index.html` during packaged runs
- applying safe default browser-window settings
- quitting cleanly with expected macOS behavior

### Preload Layer

Include a preload script even if it is minimal for the first version. This keeps the app ready for future native integrations without exposing Node APIs directly to the renderer.

For version one, the preload can expose a tiny read-only surface such as app environment metadata, or remain intentionally minimal.

## Build And Packaging Flow

### Development

Developers should be able to run one command that starts:

- the Vite dev server
- the Electron shell pointing at that local renderer URL

This keeps current UI development fast while letting the app behave like a desktop app.

### Production Build

The production build should:

1. build the renderer with Vite
2. compile the Electron main and preload files
3. package the application for macOS
4. generate a universal `.dmg`

## Security And Runtime Expectations

For this release:

- `contextIsolation` should be enabled
- direct Node access from the renderer should stay disabled
- the renderer should not rely on unsafe Electron APIs

Because the build is unsigned:

- users may need to right-click and choose Open, or use System Settings, the first time they launch it
- installation instructions should explain this clearly

## Project Structure Changes

Expected additions:

- `electron/`
  - `main.ts`
  - `preload.ts`
- supporting TypeScript config for Electron files if needed
- desktop-focused package scripts
- Electron builder configuration in `package.json` or a dedicated config file
- README instructions for desktop development and packaging

## User Experience Expectations

The desktop app should feel like the same calm portfolio tracker, just in its own Mac window.

Expected user experience:

- opening the app launches directly into the portfolio dashboard
- existing add/edit/delete transaction flows work the same way
- live price fetching behaves the same way as in the browser version
- app data remains local to the app on that Mac

## Testing Expectations

Minimum validation for this release:

- existing app tests still pass
- the web build still succeeds
- Electron build files type-check
- packaged macOS output is generated successfully
- the packaged app launches locally on the developer machine

## Acceptance Criteria

- A developer can run the app locally as a desktop shell during development.
- A build command produces a universal macOS `.dmg`.
- The packaged app opens the existing portfolio tracker UI in a native window.
- Existing portfolio functionality still works inside the desktop app.
- Documentation explains how to run, package, and open the unsigned test build.
