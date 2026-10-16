import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  AppleButton,
  GoogleButton,
  MicrosoftButton,
  useAuthara,
  type AutharaButtonError,
} from "@authara/react-native";

import { colors, typography } from "./theme";
import { Card, Field, PrimaryButton, SecondaryButton } from "./ui";

export function ReauthenticationCard({
  challengeID,
  methods,
  onSuccess,
  onError,
  onCancel,
}: {
  challengeID: string;
  methods: Set<string>;
  onSuccess(): void;
  onError(error: unknown): void;
  onCancel(): void;
}) {
  const { client } = useAuthara();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const verifyPassword = async () => {
    setPending(true);
    try {
      await client.reauthenticateWithPassword({
        body: {
          authentication_challenge_id: challengeID,
          password,
        },
      });
      onSuccess();
    } catch (error) {
      onError(error);
    } finally {
      setPending(false);
    }
  };

  const providerError = (error: AutharaButtonError) => onError(error);

  return (
    <Card tone="raised">
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>Confirm it’s really you</Text>
          <Text style={styles.detail}>
            Sensitive account changes require a fresh sign-in. Your work stays
            on this screen after verification.
          </Text>
        </View>
        {methods.has("password") ? (
          <>
            <Field
              label="Current password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              placeholder="Your password"
            />
            <PrimaryButton
              label={pending ? "Verifying…" : "Verify password"}
              disabled={pending || !password}
              onPress={() => void verifyPassword()}
            />
          </>
        ) : null}
        <View style={styles.providers}>
          {methods.has("apple") ? (
            <AppleButton
              action="reauthenticate"
              authenticationChallengeId={challengeID}
              buttonText="Verify with Apple"
              mode="system"
              onSuccess={onSuccess}
              onError={providerError}
              onCancel={() =>
                onError(new Error("Apple verification cancelled"))
              }
            />
          ) : null}
          {methods.has("google") ? (
            <GoogleButton
              action="reauthenticate"
              authenticationChallengeId={challengeID}
              buttonText="Verify with Google"
              mode="system"
              onSuccess={onSuccess}
              onError={providerError}
            />
          ) : null}
          {methods.has("microsoft") ? (
            <MicrosoftButton
              action="reauthenticate"
              authenticationChallengeId={challengeID}
              buttonText="Verify with Microsoft"
              mode="system"
              onSuccess={onSuccess}
              onError={providerError}
              onCancel={() =>
                onError(new Error("Microsoft verification cancelled"))
              }
            />
          ) : null}
        </View>
        <SecondaryButton label="Not now" onPress={onCancel} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  heading: { gap: 6 },
  title: {
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700",
  },
  detail: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  providers: { gap: 9 },
});
