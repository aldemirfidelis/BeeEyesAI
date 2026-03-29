const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const shimPath = path.resolve(__dirname, "shims/react-dom-client.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-dom/client") {
    return {
      filePath: shimPath,
      type: "sourceFile",
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
