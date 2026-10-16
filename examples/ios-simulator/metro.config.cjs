const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const sdkRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [sdkRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
const appNodeModules = path.resolve(projectRoot, "node_modules");
const sharedPackages = ["react", "react-native", "expo-secure-store"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const sharedPackage = sharedPackages.find(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );

  if (sharedPackage) {
    return context.resolveRequest(
      context,
      path.join(appNodeModules, moduleName),
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
