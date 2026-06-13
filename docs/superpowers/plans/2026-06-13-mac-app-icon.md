# Mac App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a custom calm portfolio-style Mac app icon and integrate it into the Electron packaging flow so the generated `.app` and `.dmg` use branded artwork instead of the default Electron icon.

**Architecture:** Generate a single high-resolution icon source asset, then derive the macOS `.iconset` and `.icns` artifacts from that source so regeneration stays repeatable. Point `electron-builder` at the generated `.icns` and verify the packaged universal app uses the custom icon.

**Tech Stack:** Electron, electron-builder, macOS `sips`, macOS `iconutil`, PNG app icon source artwork

---

## File Structure

- Create: `build-assets/app-icon.png`
  - High-resolution source icon artwork for the Mac app.
- Create: `build-assets/mac/Crypto Portfolio Tracker.iconset/`
  - Intermediate PNG sizes required by macOS icon compilation.
- Create: `build-assets/mac/icon.icns`
  - Final packaged macOS icon consumed by Electron builder.
- Create: `scripts/generate-mac-icon.sh`
  - Repeatable asset-generation script that scales the source icon into an `.iconset` and compiles `.icns`.
- Modify: `package.json`
  - Add the Mac icon path to Electron builder and a helper script for icon regeneration.
- Modify: `README.md`
  - Document how to regenerate the icon assets if the source art changes.

### Task 1: Add Repeatable Mac Icon Asset Generation

**Files:**
- Create: `scripts/generate-mac-icon.sh`
- Create: `build-assets/app-icon.png`

- [ ] **Step 1: Confirm the icon source assets do not exist yet**

Run: `find build-assets -maxdepth 3 \\( -name "*.png" -o -name "*.icns" \\) 2>/dev/null`

Expected: no output, because the project does not yet contain dedicated Mac icon assets.

- [ ] **Step 2: Create the icon-generation script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ICON="$ROOT_DIR/build-assets/app-icon.png"
ICONSET_DIR="$ROOT_DIR/build-assets/mac/Crypto Portfolio Tracker.iconset"
OUTPUT_ICON="$ROOT_DIR/build-assets/mac/icon.icns"

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

sips -z 16 16 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICON"
```

- [ ] **Step 3: Mark the generator executable**

Run: `chmod +x scripts/generate-mac-icon.sh`

Expected: PASS with no output.

- [ ] **Step 4: Run the generator to verify it fails before source art exists**

Run: `./scripts/generate-mac-icon.sh`

Expected: FAIL because `build-assets/app-icon.png` has not been created yet.

- [ ] **Step 5: Commit**

Do not commit at the end of this task. The source artwork is still missing, so this is only a setup checkpoint.

### Task 2: Create The Source Icon And macOS Icon Artifacts

**Files:**
- Create: `build-assets/app-icon.png`
- Create: `build-assets/mac/icon.icns`

- [ ] **Step 1: Create a 1024x1024 source icon**

The source icon should include:

- a rounded-square macOS-style base
- a calm blue-green gradient background
- a centered donut allocation chart with 3 clean segments
- subtle depth, but no glow or neon effects
- strong contrast for readability at small sizes

Save the finished source art to:

`build-assets/app-icon.png`

- [ ] **Step 2: Run the generator script**

Run: `./scripts/generate-mac-icon.sh`

Expected: PASS and create:

- `build-assets/mac/Crypto Portfolio Tracker.iconset/`
- `build-assets/mac/icon.icns`

- [ ] **Step 3: Verify the generated assets exist**

Run: `find build-assets -maxdepth 3 \\( -name "*.png" -o -name "*.icns" \\) | sort`

Expected: output should include `build-assets/app-icon.png` and `build-assets/mac/icon.icns`.

- [ ] **Step 4: Commit**

```bash
git add build-assets/app-icon.png build-assets/mac/icon.icns build-assets/mac/Crypto\ Portfolio\ Tracker.iconset scripts/generate-mac-icon.sh
git commit -m "feat: add custom Mac app icon assets"
```

### Task 3: Wire The Custom Icon Into Packaging

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Update Electron builder configuration with the Mac icon**

Add a helper script and icon path:

```json
{
  "scripts": {
    "icon:mac": "./scripts/generate-mac-icon.sh"
  },
  "build": {
    "mac": {
      "icon": "build-assets/mac/icon.icns"
    }
  }
}
```

- [ ] **Step 2: Document icon regeneration in `README.md`**

Add a short section like:

```md
## Regenerate The Mac App Icon

```bash
npm run icon:mac
```

This rebuilds the `.iconset` and `.icns` files from `build-assets/app-icon.png`.
```

- [ ] **Step 3: Verify the new script is discoverable**

Run: `rg -n "icon:mac|build-assets/mac/icon.icns|Regenerate The Mac App Icon" package.json README.md`

Expected: PASS with all three references present.

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "feat: wire custom icon into Mac packaging"
```

### Task 4: Verify Packaged App Branding

**Files:**
- Verify: `build-assets/app-icon.png`
- Verify: `build-assets/mac/icon.icns`
- Verify: `package.json`

- [ ] **Step 1: Run the generator script again as a clean verification**

Run: `npm run icon:mac`

Expected: PASS and refresh the `.iconset` and `.icns` artifacts.

- [ ] **Step 2: Build the universal Mac app**

Run: `npm run desktop:build`

Expected: PASS and generate a universal `.dmg`.

- [ ] **Step 3: Confirm the packaged app exists**

Run: `find dist-electron -maxdepth 3 \\( -name "*.app" -o -name "*.dmg" \\) | sort`

Expected: output should include:

- `dist-electron/mac-universal/Crypto Portfolio Tracker.app`
- `dist-electron/Crypto Portfolio Tracker-0.1.0-universal.dmg`

- [ ] **Step 4: Launch the packaged app locally**

Open:

`dist-electron/mac-universal/Crypto Portfolio Tracker.app`

Expected: the app launches and no longer shows the default Electron icon in the Dock.

- [ ] **Step 5: Final verification**

Run:

```bash
npm test -- --run
npm run build
git status --short
```

Expected:

- tests PASS
- web build PASS
- git status shows only intended source and asset changes

- [ ] **Step 6: Commit**

```bash
git add build-assets package.json README.md scripts/generate-mac-icon.sh
git commit -m "feat: add branded Mac app icon"
```

## Self-Review

- Spec coverage:
  - custom calm icon direction: covered in Task 2
  - `.icns` generation: covered in Tasks 1 and 2
  - Electron packaging integration: covered in Task 3
  - packaged app validation: covered in Task 4
- Placeholder scan:
  - no `TODO`, `TBD`, or incomplete references remain
- Type consistency:
  - `icon:mac`, `build-assets/app-icon.png`, and `build-assets/mac/icon.icns` are named consistently across all tasks
