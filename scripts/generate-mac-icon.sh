#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ICON="$ROOT_DIR/build-assets/app-icon.png"
ICONSET_DIR="$ROOT_DIR/build-assets/mac/icon.iconset"
OUTPUT_ICON="$ROOT_DIR/build-assets/mac/icon.icns"
TIFF_ICON="$ROOT_DIR/build-assets/mac/icon.tiff"
TEMP_ICON_BASE="$(mktemp /tmp/crypto-portfolio-icon.XXXXXX)"
TEMP_ICON="${TEMP_ICON_BASE}.icns"
rm -f "$TEMP_ICON"

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"
rm -f "$OUTPUT_ICON" "$TIFF_ICON"

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

sips -s format tiff "$SOURCE_ICON" --out "$TIFF_ICON"
tiff2icns "$TIFF_ICON" "$TEMP_ICON"
[ -s "$TEMP_ICON" ]
cp "$TEMP_ICON" "$OUTPUT_ICON"
[ -s "$OUTPUT_ICON" ]
rm -f "$TEMP_ICON_BASE" "$TEMP_ICON"
rm -f "$TIFF_ICON"
