const fs = require("node:fs");
const path = require("node:path");

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function reversedGoogleClientId(clientId) {
  return clientId ? clientId.split(".").reverse().join(".") : undefined;
}

const sdkEnv = readEnv(path.resolve(__dirname, "../../.env"));
const publicUrl =
  process.env.AUTHARA_PUBLIC_URL ||
  sdkEnv.AUTHARA_PUBLIC_URL ||
  "https://playground.authara.org";
const googleIosClientId =
  process.env.AUTHARA_OAUTH_GOOGLE_IOS_CLIENT_ID ||
  sdkEnv.AUTHARA_OAUTH_GOOGLE_IOS_CLIENT_ID;
const appleIosClientId =
  process.env.AUTHARA_OAUTH_APPLE_IOS_CLIENT_ID ||
  sdkEnv.AUTHARA_OAUTH_APPLE_IOS_CLIENT_ID;
const appleClientId =
  process.env.AUTHARA_OAUTH_APPLE_CLIENT_ID ||
  sdkEnv.AUTHARA_OAUTH_APPLE_CLIENT_ID;
const googleUrlScheme = reversedGoogleClientId(googleIosClientId);
const iosBundleIdentifier =
  appleIosClientId || appleClientId || "org.authara.local-simulator";
const microsoftUrlScheme = `msauth.${iosBundleIdentifier}`;
const microsoftRedirectUri = `${microsoftUrlScheme}://auth`;

const plugins = [
  [
    "expo-build-properties",
    {
      ios: {
        deploymentTarget: "15.1",
      },
    },
  ],
  [
    "expo-secure-store",
    {
      configureAndroidBackup: true,
      faceIDPermission:
        "Allow Authara Local to protect your development session.",
    },
  ],
  "expo-apple-authentication",
];

if (googleUrlScheme) {
  plugins.push([
    "react-native-nitro-google-signin",
    { iosUrlScheme: googleUrlScheme },
  ]);
}

plugins.push("./plugins/with-xcode-27-pods.cjs");

module.exports = {
  expo: {
    name: "Authara Playground",
    slug: "authara-playground-simulator",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    scheme: ["authara-local", microsoftUrlScheme],
    ios: {
      supportsTablet: false,
      bundleIdentifier: iosBundleIdentifier,
      usesAppleSignIn: true,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
    },
    plugins,
    extra: {
      autharaBaseUrl: publicUrl.replace(/\/$/, ""),
      autharaMicrosoftRedirectUri: microsoftRedirectUri,
      ...(googleIosClientId
        ? { autharaGoogleIosClientId: googleIosClientId }
        : {}),
    },
  },
};
