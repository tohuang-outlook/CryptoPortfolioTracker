import { copyFileSync } from "node:fs";
import path from "node:path";

export default async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const sourceIcon = path.join(
    context.projectDir,
    "build-assets",
    "mac",
    "icon.icns"
  );
  const bundleIcon = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    "Contents",
    "Resources",
    "icon.icns"
  );

  copyFileSync(sourceIcon, bundleIcon);
}
