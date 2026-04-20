module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // react-native-worklets/plugin deve ser o último plugin
      "react-native-worklets/plugin",
    ],
  };
};
