import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AppleButton,
  AutharaApiError,
  GoogleButton,
  MicrosoftButton,
  useAuthara,
  type Account,
  type AuthMethod,
} from "@authara/react-native";

import { ReauthenticationCard } from "./ReauthenticationCard";
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
  SuccessBanner,
} from "./ui";

function messageFor(error: unknown): string {
  if (error instanceof AutharaApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function SecurityScreen() {
  const { client } = useAuthara();
  const [account, setAccount] = useState<Account>();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [challengeID, setChallengeID] = useState<string>();
  const [newEmail, setNewEmail] = useState("");
  const [emailChallengeID, setEmailChallengeID] = useState<string>();
  const [emailCode, setEmailCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const retryAfterReauthentication = useRef<(() => Promise<void>) | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    try {
      setAccount(
        await client.getCurrentAccount({
          sessions_limit: 1,
          passkeys_limit: 50,
        }),
      );
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const runProtected = async (
    name: string,
    action: () => Promise<unknown>,
    done: string,
    afterSuccess?: () => void,
  ) => {
    setPending(name);
    setError(undefined);
    setSuccess(undefined);
    try {
      await action();
      afterSuccess?.();
      setSuccess(done);
      await load();
    } catch (caught) {
      if (
        caught instanceof AutharaApiError &&
        caught.details?.authentication_challenge?.id
      ) {
        retryAfterReauthentication.current = () =>
          runProtected(name, action, done, afterSuccess);
        setChallengeID(caught.details.authentication_challenge.id);
        setError(undefined);
      } else {
        setError(messageFor(caught));
      }
    } finally {
      setPending(undefined);
    }
  };

  const methods = new Set(
    account?.auth_methods.map((method) => method.provider) ?? [],
  );

  const finishReauthentication = async () => {
    const retry = retryAfterReauthentication.current;
    retryAfterReauthentication.current = undefined;
    setChallengeID(undefined);
    setSuccess("Identity confirmed. Finishing your requested change…");
    if (retry) await retry();
  };

  const unlink = (method: AuthMethod) =>
    runProtected(
      `unlink-${method.provider}`,
      () => client.unlinkCurrentUserAuthMethod({ provider: method.provider }),
      `${method.provider} was removed from your account.`,
    );

  const startEmailChange = async () => {
    setPending("email");
    setError(undefined);
    setSuccess(undefined);
    try {
      const challenge = await client.startCurrentUserEmailChange({
        body: { new_email: newEmail.trim() },
      });
      setEmailChallengeID(challenge.challenge_id);
      setSuccess(`We sent a verification code to ${newEmail.trim()}.`);
    } catch (caught) {
      if (
        caught instanceof AutharaApiError &&
        caught.details?.authentication_challenge?.id
      ) {
        retryAfterReauthentication.current = startEmailChange;
        setChallengeID(caught.details.authentication_challenge.id);
      } else {
        setError(messageFor(caught));
      }
    } finally {
      setPending(undefined);
    }
  };

  const verifyEmail = () =>
    emailChallengeID &&
    void runProtected(
      "email-code",
      () =>
        client.verifyCurrentUserEmailChange({
          body: { challenge_id: emailChallengeID, code: emailCode.trim() },
        }),
      "Your email address was updated.",
      () => {
        setEmailChallengeID(undefined);
        setEmailCode("");
        setNewEmail("");
      },
    );

  const savePassword = () => {
    const action = methods.has("password")
      ? () =>
          client.changeCurrentUserPassword({
            body: {
              current_password: currentPassword,
              new_password: newPassword,
            },
          })
      : () =>
          client.addCurrentUserPassword({ body: { password: newPassword } });
    void runProtected(
      "password",
      action,
      methods.has("password")
        ? "Password changed. Other sessions were signed out."
        : "Password sign-in was added to your account.",
      () => {
        setCurrentPassword("");
        setNewPassword("");
      },
    );
  };

  const checkRecentAuthentication = async () => {
    setPending("check");
    setError(undefined);
    setSuccess(undefined);
    try {
      await client.checkRecentAuthentication();
      setSuccess(
        "Your identity was verified recently. Sensitive changes are unlocked.",
      );
    } catch (caught) {
      if (
        caught instanceof AutharaApiError &&
        caught.details?.authentication_challenge?.id
      ) {
        setChallengeID(caught.details.authentication_challenge.id);
      } else {
        setError(messageFor(caught));
      }
    } finally {
      setPending(undefined);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
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
          <Pill label="Security center" tone="success" />
          <Text style={styles.title}>Keep your account yours.</Text>
          <Text style={styles.subtitle}>
            Manage how you sign in, verify a new email, update your password,
            and remove lost passkeys.
          </Text>
        </View>

        {error ? <ErrorBanner message={error} /> : null}
        {success ? <SuccessBanner message={success} /> : null}
        {challengeID ? (
          <View style={styles.section}>
            <ReauthenticationCard
              challengeID={challengeID}
              methods={methods}
              onSuccess={() => void finishReauthentication()}
              onError={(caught) => setError(messageFor(caught))}
              onCancel={() => {
                retryAfterReauthentication.current = undefined;
                setChallengeID(undefined);
              }}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading
            title="Sign-in methods"
            detail="Keep at least one method connected so you cannot lock yourself out."
          />
          <View style={styles.list}>
            {(account?.auth_methods ?? []).map((method) => (
              <Card key={method.provider}>
                <View style={styles.methodRow}>
                  <View style={styles.methodCopy}>
                    <Text style={styles.itemTitle}>
                      {method.provider[0].toUpperCase() +
                        method.provider.slice(1)}
                    </Text>
                    <Text style={styles.itemDetail}>
                      Connected sign-in method
                    </Text>
                  </View>
                  <SecondaryButton
                    label={
                      pending === `unlink-${method.provider}`
                        ? "Removing…"
                        : "Remove"
                    }
                    danger
                    disabled={pending !== undefined || methods.size <= 1}
                    onPress={() => void unlink(method)}
                  />
                </View>
              </Card>
            ))}
          </View>
          <View style={styles.providers}>
            {!methods.has("apple") ? (
              <AppleButton
                action="link"
                buttonText="Connect Apple"
                mode="system"
                onSuccess={load}
                onError={(caught) => setError(messageFor(caught))}
                onCancel={() => setError("Apple linking was cancelled")}
              />
            ) : null}
            {!methods.has("google") ? (
              <GoogleButton
                action="link"
                buttonText="Connect Google"
                mode="system"
                onSuccess={load}
                onError={(caught) => setError(messageFor(caught))}
              />
            ) : null}
            {!methods.has("microsoft") ? (
              <MicrosoftButton
                action="link"
                buttonText="Connect Microsoft"
                mode="system"
                onSuccess={load}
                onError={(caught) => setError(messageFor(caught))}
                onCancel={() => setError("Microsoft linking was cancelled")}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Email address"
            detail={`Your current email is ${account?.user.email ?? "loading…"}.`}
          />
          <Card tone="raised">
            <View style={styles.form}>
              {emailChallengeID ? (
                <>
                  <Field
                    label="Verification code"
                    value={emailCode}
                    onChangeText={setEmailCode}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    placeholder="000000"
                  />
                  <PrimaryButton
                    label={
                      pending === "email-code"
                        ? "Verifying…"
                        : "Confirm new email"
                    }
                    disabled={pending !== undefined || !emailCode.trim()}
                    onPress={() => void verifyEmail()}
                  />
                  <SecondaryButton
                    label="Send code again"
                    disabled={pending !== undefined}
                    onPress={() =>
                      void client
                        .resendChallenge({
                          session_transport: "token",
                          body: { challenge_id: emailChallengeID },
                        })
                        .then(() => setSuccess("A new code is on its way."))
                        .catch((caught) => setError(messageFor(caught)))
                    }
                  />
                </>
              ) : (
                <>
                  <Field
                    label="New email"
                    value={newEmail}
                    onChangeText={setNewEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder="you@example.com"
                  />
                  <PrimaryButton
                    label={
                      pending === "email"
                        ? "Sending…"
                        : "Send verification code"
                    }
                    disabled={pending !== undefined || !newEmail.trim()}
                    onPress={() => void startEmailChange()}
                  />
                </>
              )}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Password"
            detail={
              methods.has("password")
                ? "Changing it signs out your other devices."
                : "Add password sign-in as a backup to your connected providers."
            }
          />
          <Card tone="raised">
            <View style={styles.form}>
              {methods.has("password") ? (
                <Field
                  label="Current password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  textContentType="password"
                  placeholder="Current password"
                />
              ) : null}
              <Field
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                textContentType="newPassword"
                placeholder="At least 15 characters"
              />
              <PrimaryButton
                label={
                  pending === "password"
                    ? "Saving…"
                    : methods.has("password")
                      ? "Change password"
                      : "Add password"
                }
                disabled={
                  pending !== undefined ||
                  !newPassword ||
                  (methods.has("password") && !currentPassword)
                }
                onPress={savePassword}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Passkeys"
            detail="Review registered passkeys and remove any device you no longer use."
          />
          {(account?.passkeys ?? []).length ? (
            <View style={styles.list}>
              {account?.passkeys.map((passkey) => (
                <Card key={passkey.id}>
                  <DataRow label="Name" value={passkey.name} />
                  <SecondaryButton
                    label={
                      pending === passkey.id ? "Removing…" : "Remove passkey"
                    }
                    danger
                    disabled={pending !== undefined}
                    onPress={() =>
                      void runProtected(
                        passkey.id,
                        () =>
                          client.deleteCurrentUserPasskey({
                            passkeyID: passkey.id,
                          }),
                        `${passkey.name} was removed.`,
                      )
                    }
                  />
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <Text style={styles.empty}>No passkeys are registered.</Text>
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Sensitive changes"
            detail="Check whether Authara still considers this session recently verified."
          />
          <SecondaryButton
            label={pending === "check" ? "Checking…" : "Check security status"}
            disabled={pending !== undefined}
            onPress={() => void checkRecentAuthentication()}
          />
        </View>
      </ScreenReveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 34, paddingBottom: 80, gap: 16 },
  hero: { gap: 14, marginBottom: 20 },
  title: {
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 40,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  section: { marginTop: 24 },
  list: { gap: 10 },
  providers: { gap: 10, marginTop: 12 },
  form: { gap: 15 },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  methodCopy: { flex: 1, gap: 3 },
  itemTitle: {
    color: colors.text,
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "700",
  },
  itemDetail: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 12,
  },
  empty: { color: colors.muted, fontFamily: typography.body, fontSize: 13 },
});
