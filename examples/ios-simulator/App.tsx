import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Appearance,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import {
  AutharaProvider,
  createAuthara,
  useAuthara,
} from "@authara/react-native";
import { createExpoSecureStore } from "@authara/react-native/expo-secure-store";

import { AccountScreen } from "./src/AccountScreen";
import { AuthScreen } from "./src/AuthScreen";
import { OrganizationsScreen } from "./src/OrganizationsScreen";
import { SecurityScreen } from "./src/SecurityScreen";
import { colors, typography } from "./src/theme";
import { BrandHeader } from "./src/ui";
import { nativeProviders } from "./src/providers";

const baseUrl =
  process.env.EXPO_PUBLIC_AUTHARA_URL?.replace(/\/$/, "") ??
  (Constants.expoConfig?.extra?.autharaBaseUrl as string | undefined) ??
  "https://playground.authara.org";

const authara = createAuthara({
  baseUrl,
  allowInsecureHttp: __DEV__,
  providers: nativeProviders,
  storage: createExpoSecureStore({ key: "authara-local-refresh-token" }),
});

function Simulator() {
  const { status } = useAuthara();
  const systemColorMode = useColorScheme();
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(true);
  const [colorMode, setColorMode] = useState<"light" | "dark">(
    systemColorMode ?? "dark",
  );
  const [screen, setScreen] = useState<"profile" | "teams" | "security">(
    "profile",
  );

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch(`${baseUrl}/auth/ready`);
      setOnline(response.ok);
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    Appearance.setColorScheme(colorMode);
  }, [colorMode]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={colorMode === "dark" ? "light-content" : "dark-content"}
      />
      <BrandHeader
        endpoint={baseUrl}
        online={online}
        checking={checking}
        onRetry={() => void checkConnection()}
      />
      <View style={styles.appearanceRow}>
        <Text style={styles.appearanceLabel}>APPEARANCE</Text>
        <View style={styles.appearanceToggle} accessibilityRole="tablist">
          {(["light", "dark"] as const).map((mode) => {
            const selected = colorMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setColorMode(mode)}
                style={[
                  styles.appearanceOption,
                  selected && styles.appearanceOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.appearanceOptionText,
                    selected && styles.appearanceOptionTextSelected,
                  ]}
                >
                  {mode.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.screen}>
        {status === "loading" ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.loadingTitle}>Restoring secure session</Text>
            <Text style={styles.loadingDetail}>
              Rotating the persisted refresh token with the Authara playground.
            </Text>
          </View>
        ) : status === "authenticated" ? (
          <>
            <View style={styles.navigation} accessibilityRole="tablist">
              {(["profile", "teams", "security"] as const).map((item) => {
                const selected = screen === item;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    key={item}
                    onPress={() => setScreen(item)}
                    style={[
                      styles.navigationItem,
                      selected && styles.navigationSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.navigationText,
                        selected && styles.navigationTextSelected,
                      ]}
                    >
                      {item === "teams" ? "WORKSPACES" : item.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.screen}>
              {screen === "profile" ? (
                <AccountScreen />
              ) : screen === "teams" ? (
                <OrganizationsScreen />
              ) : (
                <SecurityScreen />
              )}
            </View>
          </>
        ) : (
          <AuthScreen />
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AutharaProvider client={authara}>
        <Simulator />
      </AutharaProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.ink },
  screen: { flex: 1 },
  appearanceRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  appearanceLabel: {
    color: colors.muted,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  appearanceToggle: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  appearanceOption: {
    minWidth: 58,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  appearanceOptionSelected: { backgroundColor: colors.surfaceRaised },
  appearanceOptionText: {
    color: colors.muted,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  appearanceOptionTextSelected: { color: colors.text },
  navigation: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  navigationItem: {
    minHeight: 36,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  navigationSelected: { backgroundColor: colors.surfaceRaised },
  navigationText: {
    color: colors.muted,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  navigationTextSelected: { color: colors.accent },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  loadingTitle: {
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700",
  },
  loadingDetail: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
