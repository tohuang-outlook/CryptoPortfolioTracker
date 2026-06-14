import { mkdirSync, statSync, copyFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const swiftModuleCacheDir = path.join(rootDir, ".swift-module-cache");
const sourceIcon = path.join(rootDir, "build-assets", "mac", "icon.icns");
const buildDir = path.join(rootDir, "build");
const outputIcon = path.join(buildDir, "icon.icns");
const maxAttempts = 3;

function hasContent(filePath) {
  try {
    return statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ...options.env,
    },
  });

  return result.status ?? 1;
}

mkdirSync(swiftModuleCacheDir, { recursive: true });

let buildSucceeded = false;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`[icon:mac] attempt ${attempt}/${maxAttempts}`);

  const swiftExit = run("swift", [
    "scripts/render-mac-icon.swift",
    "build-assets/app-icon.png",
  ], {
    env: {
      SWIFT_MODULECACHE_PATH: swiftModuleCacheDir,
      CLANG_MODULE_CACHE_PATH: swiftModuleCacheDir,
    },
  });

  if (swiftExit !== 0) {
    throw new Error(`Swift icon render failed with exit code ${swiftExit}.`);
  }

  const generateExit = run("bash", ["scripts/generate-mac-icon.sh"]);

  if (generateExit === 0 && hasContent(sourceIcon)) {
    buildSucceeded = true;
    break;
  }

  console.warn(
    `[icon:mac] icon generation did not produce a usable .icns file on attempt ${attempt}.`
  );
}

if (!buildSucceeded) {
  throw new Error(
    "Mac icon generation failed after 3 attempts. build-assets/mac/icon.icns is missing or empty."
  );
}

mkdirSync(buildDir, { recursive: true });
copyFileSync(sourceIcon, outputIcon);

if (!hasContent(outputIcon)) {
  throw new Error("Prepared build/icon.icns is missing or empty.");
}

console.log(`[icon:mac] ready: ${outputIcon}`);
