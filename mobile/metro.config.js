const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const shimPath = path.resolve(__dirname, "shims/react-dom-client.js");
const mobileRoot = __dirname;
const sharedRoot = path.resolve(__dirname, "../shared");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-dom/client") {
    return {
      filePath: shimPath,
      type: "sourceFile",
    };
  }

  if (moduleName.startsWith("@mobile/")) {
    return context.resolveRequest(
      context,
      path.resolve(mobileRoot, moduleName.replace("@mobile/", "")),
      platform,
    );
  }

  if (moduleName.startsWith("@shared/")) {
    return context.resolveRequest(
      context,
      path.resolve(sharedRoot, moduleName.replace("@shared/", "")),
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
