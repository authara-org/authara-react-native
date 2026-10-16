import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useEffect, useRef, type ReactNode } from "react";

import { colors, radius, typography } from "./theme";

export function ScreenReveal({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      damping: 18,
      stiffness: 120,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <Animated.View
      style={[
        styles.reveal,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function BrandHeader({
  endpoint,
  online,
  checking,
  onRetry,
}: {
  endpoint: string;
  online: boolean;
  checking: boolean;
  onRetry(): void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brandMark} accessibilityElementsHidden>
        <Text style={styles.brandMarkText}>A</Text>
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.brandName}>AUTHARA LOCAL</Text>
        <Text numberOfLines={1} style={styles.endpoint}>
          {endpoint.replace(/^https?:\/\//, "")}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check Authara connection"
        onPress={onRetry}
        style={({ pressed }) => [styles.connection, pressed && styles.pressed]}
      >
        <View
          style={[
            styles.connectionDot,
            { backgroundColor: online ? colors.accent : colors.danger },
          ]}
        />
        <Text style={styles.connectionText}>
          {checking ? "Checking" : online ? "Online" : "Offline"}
        </Text>
      </Pressable>
    </View>
  );
}

export function Card({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "raised";
}) {
  return (
    <View style={[styles.card, tone === "raised" && styles.cardRaised]}>
      {children}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress(): void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        danger && styles.dangerButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.secondaryButtonText, danger && styles.dangerButtonText]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl({
  value,
  onChange,
}: {
  value: "login" | "signup";
  onChange(value: "login" | "signup"): void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {(["login", "signup"] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              style={[
                styles.segmentText,
                selected && styles.segmentTextSelected,
              ]}
            >
              {option === "login" ? "Sign in" : "Create account"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeading({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function DataRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.dataRow, last && styles.dataRowLast]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text selectable style={styles.dataValue}>
        {value}
      </Text>
    </View>
  );
}

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === "success" && styles.pillSuccess,
        tone === "warning" && styles.pillWarning,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === "success" && styles.pillTextSuccess,
          tone === "warning" && styles.pillTextWarning,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <Text style={styles.errorTitle}>Request failed</Text>
      <Text selectable style={styles.errorMessage}>
        {message}
      </Text>
    </View>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.successBanner}>
      <Text style={styles.successTitle}>Done</Text>
      <Text style={styles.successMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reveal: { width: "100%" },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  brandMark: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.accent,
  },
  brandMarkText: {
    color: colors.accentInk,
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: "800",
  },
  headerCopy: { flex: 1 },
  brandName: {
    color: colors.text,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  endpoint: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 12,
  },
  connection: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
  },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: {
    color: colors.text,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
  },
  cardRaised: { backgroundColor: colors.surfaceRaised },
  fieldGroup: { gap: 8 },
  fieldLabel: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
    color: colors.text,
    fontFamily: typography.body,
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.medium,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.accentInk,
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700",
  },
  dangerButton: {
    borderColor: colors.dangerButtonBorder,
    backgroundColor: colors.dangerButtonSurface,
  },
  dangerButtonText: { color: colors.danger },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  segmented: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
  },
  segment: {
    minHeight: 42,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  segmentSelected: { backgroundColor: colors.surfaceRaised },
  segmentText: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: "700",
  },
  segmentTextSelected: { color: colors.text },
  sectionHeading: { gap: 4, marginBottom: 12 },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.display,
    fontSize: 20,
    fontWeight: "700",
  },
  sectionDetail: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  dataRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  dataRowLast: { borderBottomWidth: 0 },
  dataLabel: {
    color: colors.muted,
    fontFamily: typography.body,
    fontSize: 13,
  },
  dataValue: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  pillSuccess: { backgroundColor: colors.successPill },
  pillWarning: { backgroundColor: colors.warningPill },
  pillText: {
    color: colors.muted,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  pillTextSuccess: { color: colors.accent },
  pillTextWarning: { color: colors.warning },
  errorBanner: {
    gap: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.medium,
    backgroundColor: colors.dangerSurface,
  },
  errorTitle: {
    color: colors.danger,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
  },
  errorMessage: {
    color: colors.dangerMessage,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
  successBanner: {
    gap: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.medium,
    backgroundColor: colors.successSurface,
  },
  successTitle: {
    color: colors.accent,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: "800",
  },
  successMessage: {
    color: colors.successMessage,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
