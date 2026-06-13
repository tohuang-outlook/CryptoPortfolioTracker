# Mac App Icon Design

## Summary

This update adds a custom macOS app icon to Crypto Portfolio Tracker so the desktop app feels polished and recognizable in Finder, the Dock, Applications, and the generated DMG.

The icon direction is intentionally calm and professional rather than flashy or trader-focused. It should reflect portfolio allocation and long-term investing clarity instead of short-term crypto speculation.

## Goals

- Create a custom icon for the macOS desktop app.
- Match the existing app's calm finance visual language.
- Make the icon recognizable at small Dock and Finder sizes.
- Integrate the icon into Electron packaging so generated `.app` and `.dmg` builds use it.

## Non-Goals

- Building a full brand identity system.
- Creating separate Windows `.ico` or web favicon assets in this update.
- Adding animated or alternate seasonal icons.

## Visual Direction

### Chosen Style

- Tone: minimal, professional, stable
- Primary idea: allocation donut chart
- Emotional feel: trustworthy, clear, composed

### Core Symbol

The icon should center around a simplified donut allocation chart:

- 2 or 3 chart segments
- clean negative space in the middle
- balanced geometry instead of noisy detail

This makes the icon feel like a portfolio overview tool rather than an exchange, wallet, or meme-coin product.

### Color Direction

Use colors that align with the current app UI:

- deep teal / blue-green for the primary segment
- mint or pale green for a secondary segment
- dark slate for contrast
- soft light background or layered gradient base

The palette should feel calm and premium, not neon or high-volatility.

### Composition

The final macOS icon should use:

- rounded-square app-icon silhouette
- subtle depth or layering so it feels native on macOS
- a large centered symbol with generous padding

The donut chart must remain readable at small sizes, so the design should avoid tiny labels, text, or thin detail.

## Technical Deliverables

- a high-resolution source image for the icon
- exported PNG sizes suitable for `.iconset` generation
- a generated `.icns` file for Electron packaging
- Electron builder configuration updated to point at the new icon

## Project Changes

Expected additions:

- `build-assets/app-icon.png` or equivalent high-resolution source
- `build-assets/mac/icon.icns`
- helper script or repeatable command path for regenerating the icon if needed

Expected modification:

- `package.json` Electron builder config to reference the Mac icon file
- `README.md` to mention where the app icon asset lives if regeneration steps are added

## Acceptance Criteria

- The packaged macOS app no longer uses the default Electron icon.
- The generated `.app` shows the custom icon in Finder and the Dock.
- The generated `.dmg` build uses the custom app branding.
- The icon visually matches the calm portfolio tracker product direction.
