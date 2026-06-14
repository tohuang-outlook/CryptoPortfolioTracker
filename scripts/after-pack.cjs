const { copyFileSync, existsSync } = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const sourceIcon = path.join(
    context.projectDir,
    "build-assets",
    "mac",
    "icon.icns"
  );

  const candidateBundleDirs = [
    path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`
    ),
    context.appOutDir
  ];

  for (const bundleDir of candidateBundleDirs) {
    const bundleIcon = path.join(
      bundleDir,
      "Contents",
      "Resources",
      "icon.icns"
    );

    if (!existsSync(bundleIcon)) {
      continue;
    }

    copyFileSync(sourceIcon, bundleIcon);
  }
};
