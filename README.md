# Crypto Portfolio Tracker

Crypto Portfolio Tracker is a calm, friendly portfolio tracker for everyday crypto investors. You can run it in the browser during development or package it as a Mac desktop app for sharing.

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

This starts Vite on a dedicated local port and opens the Electron desktop shell.

## Build Web App

```bash
npm run build
```

## Build macOS DMG

```bash
npm run desktop:build
```

The web bundle is written to `dist/`. The compiled Electron files are written to `electron-dist/`. Packaged macOS outputs are written to `dist-electron/`.

## Regenerate The Mac App Icon

```bash
npm run icon:mac
```

This rebuilds the `.iconset` and `.icns` files from `build-assets/app-icon.png`.

## Opening The Unsigned Test Build

Because this first desktop release is unsigned, macOS may block it the first time:

1. Open the generated `.dmg`
2. Drag `Crypto Portfolio Tracker.app` into Applications
3. Right-click the app and choose `Open`
4. Confirm the security prompt

If macOS still blocks launch, open `System Settings > Privacy & Security` and allow the app to open.

## Automatic Bitcoin Forecast Updates

After opening the packaged Mac app once, it registers a macOS background task that checks Coinbase hourly. When a new UTC daily BTC close is available, it saves the updated daily and weekly forecasts and reconciles prior forecast results, even while the app is closed. The Mac must be powered on and your user account must be signed in for the background task to run.
