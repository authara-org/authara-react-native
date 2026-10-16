# @authara/react-native

Official Authara client for React Native and Expo. It provides the complete
public/user API generated from Authara Core, token lifecycle management, React
context/hooks, secure-storage adapters, and provider sign-in buttons without
forcing users through Authara's browser UI.

## Install

```bash
npm install @authara/react-native react react-native react-native-svg
```

Expo apps can install the native pieces they use:

```bash
npx expo install expo-secure-store
```

## Set up

```tsx
import { AutharaProvider, createAuthara } from "@authara/react-native";
import { createExpoSecureStore } from "@authara/react-native/expo-secure-store";

const authara = createAuthara({
  baseUrl: "https://auth.example.com",
  storage: createExpoSecureStore(),
  providers: {
    google: googleAdapter,
    apple: appleAdapter,
    microsoft: microsoftAdapter,
  },
});

export function App() {
  return (
    <AutharaProvider client={authara}>
      <Routes />
    </AutharaProvider>
  );
}
```

The access token stays in memory. Only the rotating refresh token is persisted
through `AutharaTokenStorage`. On startup, `AutharaProvider` restores the
session by rotating that token. Concurrent 401 responses share one refresh,
then each request retries once with `Authorization: Bearer …`.

## Native provider adapters

Authara accepts small adapters so applications can control their native setup,
provider versions, and branding-compliant controls. The package also ships
optional Expo adapters for the common iOS setup:

```ts
import { createExpoAppleAuthentication } from "@authara/react-native/expo-apple-authentication";
import { createExpoMicrosoftAuthSession } from "@authara/react-native/expo-microsoft-auth-session";
import { createNitroGoogleSignIn } from "@authara/react-native/nitro-google-signin";

const providers = {
  apple: createExpoAppleAuthentication(),
  google: createNitroGoogleSignIn({ iosClientId: GOOGLE_IOS_CLIENT_ID }),
  microsoft: createExpoMicrosoftAuthSession({ scheme: "my-app" }),
};
```

Install only the provider packages the application uses. Apple and Google use
their native iOS SDK surfaces. Microsoft uses the secure system authentication
sheet for general Microsoft work and personal accounts.

```ts
import type { GoogleNativeAdapter } from "@authara/react-native";

export const googleAdapter: GoogleNativeAdapter = {
  async authorize({ client_id, nonce }) {
    // Configure/invoke your native Google SDK with Authara's nonce.
    const result = await nativeGoogleSignIn({ clientId: client_id, nonce });
    return { credential: result.idToken };
  },
};
```

The contract is equivalent for Apple (`code`) and Microsoft (`credential`).
Authara supplies a database-backed one-time `challenge_id`, state, and nonce;
the client returns them with the provider proof. No Authara cookie is involved.

## Buttons and hooks

```tsx
import {
  AppleButton,
  GoogleButton,
  MicrosoftButton,
  useAuthara,
} from "@authara/react-native";

function Login() {
  const { status, user } = useAuthara();
  if (status === "authenticated") return <Home user={user} />;
  return (
    <>
      <GoogleButton />
      <AppleButton />
      <MicrosoftButton />
    </>
  );
}
```

The included buttons render their provider icon, loading state, and an
accessible inline error directly below the failed control. This feedback is
enabled by default, so a provider configuration error cannot disappear below
the rest of a sign-in form. Use `showError={false}` with `onError` when the
application deliberately owns error presentation.

The public button contract mirrors `@authara/react`: `action` supports `login`,
`link`, `reauthenticate`, and `recover`; `variant` accepts `text`, `provider`,
or `icon`; `size` accepts `small`, `medium`, or `large`; `label` accepts
`sign-in`, `sign-up`, or `continue`; and `mode` accepts `light`, `dark`, or
`system`. Success callbacks receive `{ action, provider, session? }`, and
`onError` receives a structured `AutharaButtonError`.

```tsx
<GoogleButton
  action="login"
  mode="system"
  size="large"
  shape="rectangular"
  logoAlignment="left"
/>
<AppleButton
  action="link"
  variant="provider"
  color="black"
  borderRadius={12}
/>
<MicrosoftButton
  action="reauthenticate"
  authenticationChallengeId={challenge.id}
  variant="icon"
  accessibilityLabel="Use Microsoft"
/>
```

Text-button heights are 30, 36, and 44 points; icon buttons are 36, 44, and
52 points. Google additionally exposes `theme`, `border`, `shape`, and
`logoAlignment`; Apple exposes `color`, `border`, `borderRadius`, and `align`;
Microsoft exposes `border` and `align`. All three accept `buttonText`, `width`,
`fallback`, `onUnavailable`, and normal React Native `Pressable` properties.
Apple and Microsoft cancellation calls `onCancel`, not `onError`.

Google and Microsoft use their full-color SVG marks on white surfaces. Their
defaults have grey borders in light mode and no borders in dark mode. Explicit
Google `theme` or either component's `border` property overrides those
defaults.

Every control invokes the configured native adapter and then completes the
Authara token flow. Applications can style the exported component, but do not
need to recreate its icon, pending state, or error handling.

### Account collisions and safe linking

Provider login can return `account_link_required` when its verified email is
already owned by another authentication method. The structured button error
contains a short-lived recovery link and the existing methods that may prove
account ownership. Never link from an email match alone.

```tsx
const [recovery, setRecovery] = useState<AutharaAccountRecoveryLink>();

const onError = (error: AutharaButtonError) => {
  if (error.code === "account_link_required" && error.recovery) {
    setRecovery(error.recovery);
  }
};

return recovery?.proof_methods.includes("google") ? (
  <GoogleButton
    action="recover"
    recoveryLinkId={recovery.link_id}
    onSuccess={() => setRecovery(undefined)}
    onError={onError}
  />
) : (
  <MicrosoftButton onError={onError} />
);
```

The included iOS playground implements the complete version of this flow,
including Apple, Google, Microsoft, and password proof.

## Password and full API

```ts
await authara.signInWithPassword(email, password);
const account = await authara.getCurrentAccount();
await authara.changeCurrentUsername({ body: { username: "new-name" } });
await authara.signOut();
```

Every generated public/user operation is available directly on the client.
Session-creating calls use `session_transport=token`; protected calls use the
in-memory bearer token. `signOut()` attempts `/tokens/revoke` and always removes
local credentials, including while offline.

## What the application still configures

- iOS bundle ID, Sign in with Apple entitlement, URL schemes, and provider IDs
- Android application ID, signing certificate fingerprints, and intent filters
- Google/Apple/Microsoft native SDK installation and provider console settings
- navigation after authentication and deletion of app-owned cached user data
- platform keychain/keystore accessibility policy when constructing storage

Do not put OAuth client secrets in the mobile application.

## Local iOS simulator

The repository includes a native Expo development app that runs against the
real Authara Core Docker stack. From the SDK root:

```bash
cp .env.example .env
npm run example:ios
```

This builds the local SDK, starts the repository-owned Compose stack and
Cloudflare tunnel from pinned Authara images, uses
`https://playground.authara.org`, installs the example dependencies on first
run, and launches an iOS Simulator build with all three provider buttons. Set
`AUTHARA_EXAMPLE_CORE_DIR=/path/to/authara-core` to build an unreleased local
Core checkout with the repository-owned Compose override.

The app is structured like a real account product rather than an endpoint
console. Its Profile, Workspaces, and Security areas cover account details,
sessions, provider linking, reauthentication, email and password changes,
organizations, members, roles, invitations, password reset, and account-link
recovery. Browser-cookie internals and operations that require a native
WebAuthn adapter are intentionally not presented as user-facing controls.

The ignored root `.env` is the repository's single source for playground and
native-provider configuration; the React Native project does not read another
SDK's environment file.
See [`examples/ios-simulator/README.md`](examples/ios-simulator/README.md) for
Xcode prerequisites, provider registrations, Mailpit verification, and Expo Go.

## Contract provenance

`src/generated` is generated from Authara Core's canonical OpenAPI contract.
Publishing is blocked until `.codegen/manifest.json` identifies an immutable
Core release tag and exact commit.
