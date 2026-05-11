const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

module.exports = async function afterSign(context) {
  const { appOutDir, packager } = context;
  if (packager.platform.name !== "mac") return;

  const appPath = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) return;

  const reqFile = path.join(__dirname, "..", "electron", "requirements.req");
  const fwDir = path.join(appPath, "Contents", "Frameworks");
  const sign = (target, deep = false) => {
    const deepFlag = deep ? "--deep " : "";
    execSync(`codesign --force ${deepFlag}-s - "${target}"`, { stdio: "inherit" });
  };

  // Electron Framework has its own nested dylibs — sign it deeply first
  sign(path.join(fwDir, "Electron Framework.framework"), true);

  // Sign the remaining nested frameworks and helper apps
  for (const name of [
    "Squirrel.framework",
    "Mantle.framework",
    "ReactiveObjC.framework",
    "Shop Organizer Helper.app",
    "Shop Organizer Helper (GPU).app",
    "Shop Organizer Helper (Plugin).app",
    "Shop Organizer Helper (Renderer).app",
  ]) {
    const target = path.join(fwDir, name);
    if (fs.existsSync(target)) sign(target);
  }

  // Sign the outer bundle last with the stable identifier-based requirement
  execSync(
    `codesign --force -s - --requirements "${reqFile}" "${appPath}"`,
    { stdio: "inherit" }
  );
};
