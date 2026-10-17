import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AutharaApiError,
  type Account,
  type CurrentUser,
  useAuthara,
} from "@authara/react-native";

import { colors, typography } from "./theme";
import {
  Card,
  DataRow,
  ErrorBanner,
  Field,
  Pill,
  PrimaryButton,
  ScreenReveal,
  SecondaryButton,
  SectionHeading,
} from "./ui";

function messageFor(error: unknown): string {
  if (error instanceof AutharaApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountScreen() {
  const { client, user, signOut } = useAuthara();
  const [account, setAccount] = useState<Account>();
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [username, setUsername] = useState(user?.username ?? "");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [nextAccount, nextUser] = await Promise.all([
        client.getCurrentAccount({ sessions_limit: 20, passkeys_limit: 20 }),
        client.getCurrentUser(),
      ]);
      setAccount(nextAccount);
      setCurrentUser(nextUser);
      setUsername(nextAccount.user.username);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const rename = async () => {
    const nextUsername = username.trim();
    if (!nextUsername || nextUsername === account?.user.username) return;
    setAction("rename");
    setError(undefined);
    try {
      await client.changeCurrentUsername({ body: { username: nextUsername } });
      await load();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setAction(undefined);
    }
  };

  const revokeSession = async (sessionID: string) => {
    setAction(sessionID);
    setError(undefined);
    try {
      await client.revokeCurrentUserSession({ sessionID });
      await load();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setAction(undefined);
    }
  };

  const revokeOtherSessions = async () => {
    setAction("others");
    setError(undefined);
    try {
      await client.revokeCurrentUserOtherSessions();
      await load();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setAction(undefined);
    }
  };

  const signOutCurrentDevice = async () => {
    setAction("sign-out");
    setError(undefined);
    try {
      await signOut();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setAction(undefined);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            setLoading(true);
            void load();
          }}
          tintColor={colors.accent}
        />
      }
    >
      <ScreenReveal>
        <View style={styles.hero}>
          <View style={styles.heroTopline}>
            <Pill label="Authenticated" tone="success" />
            <Text style={styles.userID} numberOfLines={1}>
              {user?.id}
            </Text>
          </View>
          <Text style={styles.title}>Your account, at a glance.</Text>
          <Text style={styles.subtitle}>
            Keep your profile current and review where your account is signed
            in. Pull down whenever you want the latest information.
          </Text>
        </View>

        {error ? (
          <View style={styles.section}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading
            title="Identity"
            detail="The personal details connected to this account."
          />
          <Card>
            <DataRow label="Email" value={account?.user.email ?? "Loading…"} />
            <DataRow
              label="Verification"
              value={account?.user.email_verified ? "Verified" : "Pending"}
            />
            <DataRow
              label="Created"
              value={
                account?.user.created_at
                  ? formatDate(account.user.created_at)
                  : "Loading…"
              }
            />
            <DataRow
              label="Organization"
              value={currentUser?.organization.name ?? "Loading…"}
              last
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Profile"
            detail="Choose the name people see across your workspaces."
          />
          <Card tone="raised">
            <View style={styles.form}>
              <Field
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="username"
              />
              <PrimaryButton
                label={action === "rename" ? "Saving…" : "Update username"}
                disabled={
                  action !== undefined ||
                  !username.trim() ||
                  username.trim() === account?.user.username
                }
                onPress={() => void rename()}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Active sessions"
            detail="Sign out devices you no longer recognize or use."
          />
          <View style={styles.sessionList}>
            {(account?.sessions ?? []).map((session) => (
              <Card key={session.id}>
                <View style={styles.sessionHeader}>
                  <Pill
                    label={session.current ? "This simulator" : "Other session"}
                    tone={session.current ? "success" : "neutral"}
                  />
                  <Text style={styles.sessionDate}>
                    {formatDate(session.created_at)}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.userAgent}>
                  {session.user_agent || "Unknown user agent"}
                </Text>
                {!session.current ? (
                  <SecondaryButton
                    label={
                      action === session.id ? "Revoking…" : "Revoke session"
                    }
                    danger
                    disabled={action !== undefined}
                    onPress={() => void revokeSession(session.id)}
                  />
                ) : null}
              </Card>
            ))}
          </View>
          <SecondaryButton
            label={
              action === "others" ? "Revoking…" : "Revoke all other sessions"
            }
            danger
            disabled={action !== undefined}
            onPress={() => void revokeOtherSessions()}
          />
        </View>

        <View style={styles.signOutSection}>
          <SectionHeading
            title="Sign out"
            detail="You will need to sign in again on this device."
          />
          <SecondaryButton
            label="Sign out"
            danger
            disabled={action !== undefined}
            onPress={() => void signOutCurrentDevice()}
          />
        </View>
      </ScreenReveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 34, paddingBottom: 72 },
  hero: { gap: 15, marginBottom: 36 },
  heroTopline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  userID: {
    flex: 1,
    color: colors.muted,
    fontFamily: typography.mono,
    fontSize: 10,
    textAlign: "right",
  },
  title: {
    maxWidth: 350,
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  subtitle: {
    maxWidth: 358,
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 23,
  },
  section: { marginBottom: 32 },
  form: { gap: 16 },
  sessionList: { gap: 12, marginBottom: 12 },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  sessionDate: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 11,
  },
  userAgent: {
    marginBottom: 16,
    color: colors.text,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  signOutSection: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
