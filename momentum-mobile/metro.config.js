// WEB TEST ONLY (excluded from the shipped zip) — routes native-only modules
// to browser shims so the app can run with `expo start --web` for QA.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const SHIMS = {
  "expo-sqlite": "./shims/expo-sqlite.web.ts",
  "expo-network": "./shims/expo-network.web.ts",
  "expo-notifications": "./shims/expo-notifications.web.ts",
  "expo-file-system": "./shims/expo-file-system.web.ts",
  "expo-sharing": "./shims/expo-sharing.web.ts",
  "expo-document-picker": "./shims/expo-document-picker.web.ts",
  "@react-native-community/datetimepicker": "./shims/datetimepicker.web.tsx",
};

config.resolver.resolveRequest = (context, request, platform) => {
  if (platform === "web" && SHIMS[request]) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, SHIMS[request]),
    };
  }
  return context.resolveRequest(context, request, platform);
};

module.exports = config;
