import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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
  type AutharaAccountRecoveryLink,
  type AutharaButtonError,
  type InvitationPreview,
} from "@authara/react-native";

import { colors, typography } from "./theme";
import {
  Card,
  ErrorBanner,
  Field,
  Pill,
  PrimaryButton,
  ScreenReveal,
  SecondaryButton,
  SegmentedControl,
  SuccessBanner,
} from "./ui";

function messageFor(error: unknown): string {
  if (error instanceof AutharaApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function AuthScreen() {
  const { client } = useAuthara();
  const [flow, setFlow] = useState<"auth" | "reset" | "invitation">("auth");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupChallengeID, setSignupChallengeID] = useState<string>();
  const [verificationCode, setVerificationCode] = useState("");
  const [recovery, setRecovery] = useState<AutharaAccountRecoveryLink | null>(
    null,
  );
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [resetChallengeID, setResetChallengeID] = useState<string>();
  const [resetCode, setResetCode] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [invitationPassword, setInvitationPassword] = useState("");
  const [invitation, setInvitation] = useState<InvitationPreview>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const changeMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setSignupChallengeID(undefined);
    setVerificationCode("");
    setRecovery(null);
    setRecoveryPassword("");
    setError(undefined);
    setSuccess(undefined);
  };

  const showFlow = (nextFlow: "auth" | "reset" | "invitation") => {
    setFlow(nextFlow);
    setError(undefined);
    setSuccess(undefined);
  };

  const handleProviderError = (caught: AutharaButtonError) => {
    if (caught.code === "account_link_required" && caught.recovery) {
      setRecovery(caught.recovery);
      setRecoveryPassword("");
      setError(undefined);
      return;
    }
    setError(messageFor(caught));
  };

  const completePasswordRecovery = async () => {
    if (!recovery) return;
    setPending(true);
    setError(undefined);
    try {
      await client.completeAccountRecoveryLinkWithPassword({
        linkID: recovery.link_id,
        audience: "app",
        body: { password: recoveryPassword },
      });
      setRecovery(null);
      setRecoveryPassword("");
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  };

  const submit = async () => {
    setPending(true);
    setError(undefined);
    try {
      if (mode === "login") {
        await client.signInWithPassword(email.trim(), password);
      } else if (signupChallengeID) {
        await client.verifySignupChallenge({
          audience: "app",
          session_transport: "token",
          body: {
            challenge_id: signupChallengeID,
            code: verificationCode.trim(),
          },
        });
      } else {
        try {
          const challenge = await client.startSignupChallenge({
            audience: "app",
            session_transport: "token",
            body: { email: email.trim(), password },
          });
          setSignupChallengeID(challenge.challenge_id);
        } catch (caught) {
          if (caught instanceof AutharaApiError && caught.status === 404) {
            await client.signupDirect({
              audience: "app",
              session_transport: "token",
              body: { email: email.trim(), password },
            });
          } else {
            throw caught;
          }
        }
      }
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  };

  const submitPasswordReset = async () => {
    setPending(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      if (resetChallengeID) {
        await client.verifyPasswordResetChallenge({
          session_transport: "token",
          body: {
            challenge_id: resetChallengeID,
            code: resetCode.trim(),
          },
        });
        setResetChallengeID(undefined);
        setResetCode("");
        setPassword("");
        setFlow("auth");
        setSuccess("Password updated. You can sign in with it now.");
      } else {
        const challenge = await client.startPasswordResetChallenge({
          session_transport: "token",
          body: { email: email.trim(), new_password: password },
        });
        setResetChallengeID(challenge.challenge_id);
        setSuccess(`We sent a reset code to ${email.trim()}.`);
      }
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  };

  const submitInvitation = async () => {
    setPending(true);
    setError(undefined);
    try {
      if (invitation) {
        await client.loginAndAcceptInvitation({
          audience: "app",
          body: {
            token: invitationToken.trim(),
            password: invitationPassword,
          },
        });
      } else {
        setInvitation(
          await client.previewInvitation({ token: invitationToken.trim() }),
        );
      }
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenReveal>
          <View style={styles.hero}>
            <Pill label="Private by design" tone="success" />
            <Text style={styles.title}>Welcome to Authara.</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your profile, security, teams, members, and
              invitations from your phone.
            </Text>
          </View>

          <Card tone="raised">
            {flow === "reset" ? (
              <View style={styles.form}>
                <View style={styles.recoveryHeading}>
                  <Pill label="Account recovery" tone="warning" />
                  <Text style={styles.verificationTitle}>
                    Reset your password
                  </Text>
                  <Text style={styles.verificationDetail}>
                    {resetChallengeID
                      ? `Enter the code sent to ${email.trim()} to activate your new password.`
                      : "Choose a new password. Authara will verify ownership of your email before changing it."}
                  </Text>
                </View>
                {resetChallengeID ? (
                  <Field
                    label="Reset code"
                    value={resetCode}
                    onChangeText={setResetCode}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    placeholder="000000"
                  />
                ) : (
                  <>
                    <Field
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      placeholder="you@example.com"
                    />
                    <Field
                      label="New password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      textContentType="newPassword"
                      placeholder="At least 15 characters"
                    />
                  </>
                )}
                {error ? <ErrorBanner message={error} /> : null}
                {success ? <SuccessBanner message={success} /> : null}
                <PrimaryButton
                  label={
                    pending
                      ? resetChallengeID
                        ? "Verifying…"
                        : "Sending…"
                      : resetChallengeID
                        ? "Confirm new password"
                        : "Send reset code"
                  }
                  disabled={
                    pending ||
                    (resetChallengeID
                      ? !resetCode.trim()
                      : !email.trim() || !password)
                  }
                  onPress={() => void submitPasswordReset()}
                />
                {resetChallengeID ? (
                  <SecondaryButton
                    label="Send code again"
                    disabled={pending}
                    onPress={() =>
                      void client
                        .resendChallenge({
                          session_transport: "token",
                          body: { challenge_id: resetChallengeID },
                        })
                        .then(() => setSuccess("A new code is on its way."))
                        .catch((caught) => setError(messageFor(caught)))
                    }
                  />
                ) : null}
                <SecondaryButton
                  label="Back to sign in"
                  onPress={() => showFlow("auth")}
                />
              </View>
            ) : flow === "invitation" ? (
              <View style={styles.form}>
                <View style={styles.recoveryHeading}>
                  <Pill label="Team invitation" tone="success" />
                  <Text style={styles.verificationTitle}>Join a workspace</Text>
                  <Text style={styles.verificationDetail}>
                    Paste the token from your invitation link. You can review
                    the workspace before signing in and joining.
                  </Text>
                </View>
                <Field
                  label="Invitation token"
                  value={invitationToken}
                  onChangeText={(value) => {
                    setInvitationToken(value);
                    setInvitation(undefined);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Paste invitation token"
                />
                {invitation ? (
                  <View style={styles.invitationPreview}>
                    <Text style={styles.verificationTitle}>
                      {invitation.organization.name}
                    </Text>
                    <Text style={styles.verificationDetail}>
                      {invitation.invitation.email} will join as{" "}
                      {invitation.invitation.role}.
                    </Text>
                    <Field
                      label="Account password"
                      value={invitationPassword}
                      onChangeText={setInvitationPassword}
                      secureTextEntry
                      textContentType="password"
                      placeholder="Your Authara password"
                    />
                  </View>
                ) : null}
                {error ? <ErrorBanner message={error} /> : null}
                <PrimaryButton
                  label={
                    pending
                      ? "Working…"
                      : invitation
                        ? "Sign in and join"
                        : "Review invitation"
                  }
                  disabled={
                    pending ||
                    !invitationToken.trim() ||
                    (Boolean(invitation) && !invitationPassword)
                  }
                  onPress={() => void submitInvitation()}
                />
                <SecondaryButton
                  label="Back to sign in"
                  onPress={() => showFlow("auth")}
                />
              </View>
            ) : recovery ? (
              <View style={styles.form}>
                <Pill label="Account found · Proof required" tone="warning" />
                <View style={styles.recoveryHeading}>
                  <Text style={styles.verificationTitle}>
                    Connect your {recovery.provider} login
                  </Text>
                  <Text style={styles.verificationDetail}>
                    This email already belongs to an Authara account. Sign in
                    once with one of its existing methods below. Authara will
                    then safely attach {recovery.provider} and sign you in.
                  </Text>
                </View>

                <View style={styles.providers}>
                  {recovery.proof_methods.includes("apple") ? (
                    <AppleButton
                      action="recover"
                      recoveryLinkId={recovery.link_id}
                      buttonText="Verify with Apple"
                      mode="system"
                      size="large"
                      onSuccess={() => setRecovery(null)}
                      onError={handleProviderError}
                      onCancel={() =>
                        setError("Apple account verification was cancelled")
                      }
                    />
                  ) : null}
                  {recovery.proof_methods.includes("google") ? (
                    <GoogleButton
                      action="recover"
                      recoveryLinkId={recovery.link_id}
                      buttonText="Verify with Google"
                      mode="system"
                      size="large"
                      onSuccess={() => setRecovery(null)}
                      onError={handleProviderError}
                    />
                  ) : null}
                  {recovery.proof_methods.includes("microsoft") ? (
                    <MicrosoftButton
                      action="recover"
                      recoveryLinkId={recovery.link_id}
                      buttonText="Verify with Microsoft"
                      mode="system"
                      size="large"
                      onSuccess={() => setRecovery(null)}
                      onError={handleProviderError}
                      onCancel={() =>
                        setError("Microsoft account verification was cancelled")
                      }
                    />
                  ) : null}
                </View>

                {recovery.proof_methods.includes("password") ? (
                  <View style={styles.passwordProof}>
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>
                        or use your password
                      </Text>
                      <View style={styles.dividerLine} />
                    </View>
                    <Field
                      label="Existing account password"
                      value={recoveryPassword}
                      onChangeText={setRecoveryPassword}
                      secureTextEntry
                      textContentType="password"
                      placeholder="Your Authara password"
                    />
                    <PrimaryButton
                      label={pending ? "Verifying…" : "Verify and connect"}
                      disabled={pending || !recoveryPassword}
                      onPress={() => void completePasswordRecovery()}
                    />
                  </View>
                ) : null}

                {error ? <ErrorBanner message={error} /> : null}
                <SecondaryButton
                  label="Cancel and use another login"
                  disabled={pending}
                  onPress={() => {
                    setRecovery(null);
                    setRecoveryPassword("");
                    setError(undefined);
                  }}
                />
              </View>
            ) : (
              <View style={styles.form}>
                <SegmentedControl value={mode} onChange={changeMode} />
                {success ? <SuccessBanner message={success} /> : null}
                {!signupChallengeID ? (
                  <>
                    <View style={styles.providers}>
                      <AppleButton
                        label={mode === "signup" ? "sign-up" : "sign-in"}
                        mode="system"
                        size="large"
                        onError={handleProviderError}
                        onCancel={() => setError("Apple sign-in was cancelled")}
                      />
                      <GoogleButton
                        label={mode === "signup" ? "sign-up" : "sign-in"}
                        mode="system"
                        size="large"
                        onError={handleProviderError}
                      />
                      <MicrosoftButton
                        label={mode === "signup" ? "sign-up" : "sign-in"}
                        mode="system"
                        size="large"
                        onError={handleProviderError}
                        onCancel={() =>
                          setError("Microsoft sign-in was cancelled")
                        }
                      />
                    </View>
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or use email</Text>
                      <View style={styles.dividerLine} />
                    </View>
                  </>
                ) : null}
                {signupChallengeID ? (
                  <View style={styles.verification}>
                    <Text style={styles.verificationTitle}>
                      Check your inbox
                    </Text>
                    <Text style={styles.verificationDetail}>
                      Enter the verification code sent to {email.trim()}.
                    </Text>
                    <Field
                      label="Verification code"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      placeholder="000000"
                    />
                    <SecondaryButton
                      label="Use another email"
                      disabled={pending}
                      onPress={() => {
                        setSignupChallengeID(undefined);
                        setVerificationCode("");
                        setError(undefined);
                      }}
                    />
                  </View>
                ) : (
                  <>
                    <Field
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      placeholder="you@example.com"
                    />
                    <Field
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      textContentType={
                        mode === "login" ? "password" : "newPassword"
                      }
                      placeholder={
                        mode === "login"
                          ? "Your password"
                          : "At least 15 characters"
                      }
                    />
                  </>
                )}
                {error ? <ErrorBanner message={error} /> : null}
                <PrimaryButton
                  label={
                    pending
                      ? signupChallengeID
                        ? "Verifying…"
                        : mode === "signup"
                          ? "Sending code…"
                          : "Contacting Authara…"
                      : mode === "login"
                        ? "Sign in"
                        : signupChallengeID
                          ? "Verify and create account"
                          : "Send verification code"
                  }
                  disabled={
                    pending ||
                    (signupChallengeID
                      ? !verificationCode.trim()
                      : !email.trim() || !password)
                  }
                  onPress={() => void submit()}
                />
                {mode === "login" && !signupChallengeID ? (
                  <View style={styles.helpActions}>
                    <SecondaryButton
                      label="Forgot password"
                      onPress={() => showFlow("reset")}
                    />
                    <SecondaryButton
                      label="I have an invitation"
                      onPress={() => showFlow("invitation")}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </Card>
        </ScreenReveal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 42, paddingBottom: 56 },
  hero: { gap: 16, marginBottom: 28 },
  title: {
    maxWidth: 350,
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1.3,
    lineHeight: 43,
  },
  subtitle: {
    maxWidth: 358,
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 23,
  },
  form: { gap: 18 },
  providers: { gap: 10 },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    flex: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 12,
  },
  verification: { gap: 16 },
  recoveryHeading: { gap: 8 },
  passwordProof: { gap: 16 },
  invitationPreview: { gap: 14 },
  helpActions: { gap: 10 },
  verificationTitle: {
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700",
  },
  verificationDetail: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 21,
  },
});
