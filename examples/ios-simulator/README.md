# Authara iOS simulator

This is a real Expo development build for exercising the local React Native SDK
against Authara Core. It covers email-code signup through Mailpit, password
login and reset, secure session restoration, profile and session management,
Apple, Google, and Microsoft sign-in/linking/reauthentication, safe account
linking after a provider email collision, and complete organization, member,
role, and invitation workflows. The UI is organized as a realistic account
application with Profile, Workspaces, and Security areas. Its appearance
control switches the complete iOS interface and the exported provider buttons
between light and dark modes.

## Start everything

Prerequisites:

- macOS with Xcode and an installed iOS Simulator runtime
- Docker Desktop
- Node.js 22 or newer

Create the React Native repository's local environment once:

```bash
cp .env.example .env
```

Fill `.env` with the playground URL, Cloudflare tunnel token, provider server
configuration, and public native client IDs. The file is ignored by Git and is
the only playground environment file read by this repository.

Generate independent signing and challenge keys, keeping the IDs from
`.env.example`:

```bash
openssl rand -base64 32 # AUTHARA_JWT_PRIVATE_KEYS=playground:<output>
openssl rand -base64 32 # AUTHARA_CHALLENGE_VERIFICATION_CODE_KEYS=playground-challenge:<output>
```

From the React Native SDK root, run:

```bash
npm run example:ios
```

The command:

1. starts the released Authara Core and migrations images pinned in this
   repository's `.env`;
2. starts Postgres, Redis, Mailpit, the gateway, and Cloudflare tunnel using
   this repository's `.env`;
3. waits for both the local gateway and
   `https://playground.authara.org/auth/ready`;
4. builds the local `@authara/react-native` package;
5. installs this example's dependencies on first run; and
6. builds and opens the app in Simulator on Xcode 26 or Device Hub on Xcode 27.

Set `AUTHARA_IOS_DEVICE` to an iPhone name or UDID to choose a specific device.
Otherwise, the launcher reuses a booted iPhone or selects the first available
one.

To test unreleased Core work, set `AUTHARA_EXAMPLE_CORE_DIR` in the React Native
repository's `.env` to an absolute path or a path relative to the repository.
The launcher adds `docker-compose.playground.local.yaml` and builds Core plus
its migrations locally; no Core `.env` is read. You can also override it for a
single run:

```bash
cp docker-compose.playground.local.example.yaml docker-compose.playground.local.yaml
AUTHARA_EXAMPLE_CORE_DIR=/absolute/path/to/authara-core npm run example:ios
```

On Xcode 26, you can use Expo Go instead of compiling a development build:

```bash
npm run example:ios:go
```

Xcode 27 uses Device Hub, which the example's Expo SDK 54 Expo Go launcher does
not support. Use `npm run example:ios` there; the native launcher supports both
Xcode generations.

## Local services

- Mobile API and readiness: `https://playground.authara.org`
- Authara gateway: `http://localhost:3002`
- Authara readiness: `http://localhost:3002/auth/ready`
- Mailpit verification inbox: `http://localhost:8026`

The simulator uses the public playground URL by default, which exercises the
same Cloudflare path as a physical phone. Override it when needed:

```bash
EXPO_PUBLIC_AUTHARA_URL=http://192.168.1.20:3001 npm run example:ios
```

The app allows insecure HTTP only in this local development configuration.

## Stop or inspect Core

```bash
npm run example:core:logs
npm run example:core:down
```

## Provider setup

The launcher reads server provider values, native public identifiers, and the
tunnel token from the React Native repository's root `.env`. It never copies
provider secrets into the app. The app only receives public identifiers from
Core's options endpoints and Expo configuration.

- Google additionally requires `AUTHARA_OAUTH_GOOGLE_IOS_CLIENT_ID` in the
  React Native `.env`. It must be an iOS OAuth client for the simulator's
  bundle identifier; the existing web client ID remains the server audience.
- Apple currently uses one client ID per Core instance. For this mobile
  playground, `AUTHARA_OAUTH_APPLE_IOS_CLIENT_ID` overrides the Core Apple
  client ID and becomes the app bundle identifier. Set it to an App ID with
  Sign in with Apple enabled. When omitted, `AUTHARA_OAUTH_APPLE_CLIENT_ID`
  is reused and must itself be a native Apple App ID.
- Microsoft requires the iOS redirect URI generated from the app bundle ID on
  the existing Entra app registration. For the current playground, add the
  iOS/macOS platform with bundle ID `org.authara.playground.ios`; Entra will
  generate `msauth.org.authara.playground.ios://auth`. Microsoft presents its
  secure system authentication sheet.

The mobile identifiers are public. Provider secrets also live in the ignored
root `.env` because Compose passes them to Core, but Expo never serializes them
into the application bundle.
