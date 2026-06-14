import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceIcon = path.join(rootDir, "build-assets", "mac", "icon.icns");
const buildDir = path.join(rootDir, "build");
const outputIcon = path.join(buildDir, "icon.icns");

mkdirSync(buildDir, { recursive: true });
copyFileSync(sourceIcon, outputIcon);
