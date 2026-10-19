import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type DimensionValue,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Path, Rect, Svg } from "react-native-svg";

import {
  resolveAutharaAction,
  type AutharaAction,
  type AutharaActionProps,
  type AutharaActionSuccess,
  type AutharaProviderName,
  type MaybePromise,
} from "./button-contract.js";
import {
  appleButtonAppearance,
  autharaButtonLabel,
  googleButtonAppearance,
  microsoftButtonAppearance,
  type ButtonAppearance,
} from "./button-appearance.js";
import {
  autharaButtonErrorMessage,
  isAutharaProviderCancellation,
  toAutharaButtonError,
  type AutharaButtonError,
} from "./button-error.js";
import type { AutharaAudience } from "./client.js";
import { useAuthara } from "./context.js";

export type AutharaButtonVariant = "icon" | "provider" | "text";
export type AutharaButtonLabel = "continue" | "sign-in" | "sign-up";
export type AutharaButtonSize = "small" | "medium" | "large";
export type AutharaColorMode = "light" | "dark" | "system";
export type AutharaButtonMode = AutharaColorMode;

interface AutharaNativeControlProps extends Omit<
  PressableProps,
  "children" | "style"
> {
  buttonText?: string;
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  errorTextStyle?: StyleProp<TextStyle>;
  fallback?: ReactNode;
  showError?: boolean;
  onUnavailable?: () => void;
}

interface AutharaButtonVisualProps extends AutharaNativeControlProps {
  variant?: AutharaButtonVariant;
  size?: AutharaButtonSize;
  label?: AutharaButtonLabel;
  mode?: AutharaColorMode;
}

export interface GoogleButtonVisualProps extends AutharaButtonVisualProps {
  locale?: string;
  theme?: "light" | "dark" | "neutral";
  border?: boolean;
  shape?: "pill" | "circle" | "square" | "rectangular";
  logoAlignment?: "left" | "center";
  onCancel?: () => void;
}

export interface AppleButtonVisualProps extends AutharaButtonVisualProps {
  locale?: string;
  color?: "black" | "white";
  border?: boolean;
  borderRadius?: number;
  align?: "center" | "left";
  onCancel?: () => void;
}

export interface MicrosoftButtonVisualProps extends AutharaButtonVisualProps {
  border?: boolean;
  align?: "center" | "left";
  onCancel?: () => void;
}

export type GoogleButtonProps = GoogleButtonVisualProps &
  AutharaActionProps<"google">;
export type AppleButtonProps = AppleButtonVisualProps &
  AutharaActionProps<"apple">;
export type MicrosoftButtonProps = MicrosoftButtonVisualProps &
  AutharaActionProps<"microsoft">;

/** @deprecated Prefer the provider-specific button prop type. */
export type AutharaButtonProps =
  GoogleButtonProps | AppleButtonProps | MicrosoftButtonProps;

type InternalActionProps<P extends AutharaProviderName> = {
  action?: AutharaAction;
  audience?: AutharaAudience;
  authenticationChallengeId?: string;
  recoveryLinkId?: string;
  onSuccess?: (result: AutharaActionSuccess<P>) => MaybePromise<void>;
  onError?: (error: AutharaButtonError) => void;
};

type ProviderButtonProps<P extends AutharaProviderName> =
  AutharaNativeControlProps &
    InternalActionProps<P> & {
      provider: P;
      providerLabel: "Apple" | "Google" | "Microsoft";
      variant: AutharaButtonVariant;
      label: string;
      appearance: ButtonAppearance;
      onCancel?: () => void;
    };

function useResolvedColorMode(mode: AutharaColorMode): "light" | "dark" {
  const system = useColorScheme();
  return mode === "system" ? (system ?? "light") : mode;
}

function reportError(
  error: AutharaButtonError,
  setError: (message: string | undefined) => void,
  onError: ((error: AutharaButtonError) => void) | undefined,
) {
  setError(autharaButtonErrorMessage(error));
  onError?.(error);
}

function ProviderButton<P extends AutharaProviderName>({
  provider,
  providerLabel,
  action,
  audience,
  authenticationChallengeId,
  recoveryLinkId,
  onSuccess,
  onError,
  onCancel,
  variant,
  label,
  appearance,
  style,
  textStyle,
  errorTextStyle,
  fallback = null,
  showError = true,
  onUnavailable,
  disabled,
  accessibilityLabel,
  accessibilityState,
  onPress,
  ...pressableProps
}: ProviderButtonProps<P>) {
  const { client } = useAuthara();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const unavailableNotified = useRef(false);
  const available = client.hasNativeProvider(provider);
  const inactive = Boolean(disabled || pending);

  useEffect(() => {
    if (!available && !unavailableNotified.current) {
      unavailableNotified.current = true;
      onUnavailable?.();
    }
  }, [available, onUnavailable]);

  if (!available) return <>{fallback}</>;

  const icon = pending ? (
    <ActivityIndicator color={appearance.text} size="small" />
  ) : (
    <ProviderIcon provider={provider} color={appearance.text} />
  );

  return (
    <View style={[styles.container, { width: appearance.width }]}>
      <Pressable
        {...pressableProps}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{
          ...accessibilityState,
          disabled: inactive,
          busy: pending,
        }}
        disabled={inactive}
        onPress={(event) => {
          onPress?.(event);
          if (event.isDefaultPrevented()) return;

          setPending(true);
          setError(undefined);
          void (async () => {
            let selected;
            try {
              selected = resolveAutharaAction(
                action,
                audience,
                authenticationChallengeId,
                recoveryLinkId,
              );
            } catch (caught) {
              reportError(
                toAutharaButtonError(
                  caught,
                  `The ${providerLabel} button action is not configured correctly.`,
                  "configuration",
                ),
                setError,
                onError,
              );
              return;
            }

            let result: AutharaActionSuccess<P>;
            try {
              result = await client.runNativeProviderAction(provider, selected);
            } catch (caught) {
              if (isAutharaProviderCancellation(caught)) {
                onCancel?.();
                return;
              }
              reportError(
                toAutharaButtonError(
                  caught,
                  `${providerLabel} ${selected.action} failed.`,
                  "provider",
                ),
                setError,
                onError,
              );
              return;
            }

            try {
              await onSuccess?.(result);
            } catch (caught) {
              reportError(
                toAutharaButtonError(
                  caught,
                  `The ${providerLabel} success callback failed.`,
                  "consumer",
                ),
                setError,
                onError,
              );
            }
          })().finally(() => setPending(false));
        }}
        style={({ pressed }) => [
          styles.button,
          {
            height: appearance.height,
            paddingHorizontal:
              variant === "icon" ? 0 : appearance.horizontalPadding,
            borderColor: appearance.border,
            borderRadius: appearance.borderRadius,
            borderWidth: appearance.borderWidth,
            backgroundColor: appearance.fill,
          },
          style,
          pressed && !inactive && styles.pressed,
          inactive && styles.disabled,
        ]}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.iconSlot,
            appearance.iconLeft !== undefined && {
              position: "absolute",
              left: appearance.iconLeft,
            },
          ]}
        >
          {icon}
        </View>
        {variant !== "icon" ? (
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: appearance.text,
                fontFamily: appearance.fontFamily,
                fontWeight: appearance.fontWeight,
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
        ) : null}
      </Pressable>
      {showError && error ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={[styles.error, errorTextStyle]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function GoogleButton(props: GoogleButtonProps) {
  const internal = props as GoogleButtonVisualProps &
    InternalActionProps<"google">;
  const {
    action = "login",
    audience,
    authenticationChallengeId,
    recoveryLinkId,
    onSuccess,
    onError,
    onCancel,
    variant = "text",
    size = "large",
    label = action === "login" ? "sign-in" : "continue",
    mode = "light",
    theme,
    border,
    shape = "rectangular",
    logoAlignment = "center",
    buttonText,
    width,
    locale,
    ...buttonProps
  } = internal;
  void locale;
  const resolvedMode = useResolvedColorMode(mode);
  const visibleLabel =
    buttonText ??
    (variant === "provider" ? "Google" : autharaButtonLabel(label, "Google"));

  return (
    <ProviderButton
      {...buttonProps}
      provider="google"
      providerLabel="Google"
      action={action}
      audience={audience}
      authenticationChallengeId={authenticationChallengeId}
      recoveryLinkId={recoveryLinkId}
      onSuccess={onSuccess}
      onError={onError}
      onCancel={onCancel}
      variant={variant}
      label={visibleLabel}
      appearance={googleButtonAppearance({
        variant,
        size,
        width,
        mode: resolvedMode,
        theme,
        border,
        shape,
        logoAlignment,
      })}
    />
  );
}

export function AppleButton(props: AppleButtonProps) {
  const internal = props as AppleButtonVisualProps &
    InternalActionProps<"apple">;
  const {
    action = "login",
    audience,
    authenticationChallengeId,
    recoveryLinkId,
    onSuccess,
    onError,
    onCancel,
    variant = "text",
    size = "large",
    label = action === "login" ? "sign-in" : "continue",
    mode = "light",
    color,
    border = false,
    borderRadius = 12,
    align = "center",
    buttonText,
    width,
    locale,
    ...buttonProps
  } = internal;
  void locale;
  const resolvedMode = useResolvedColorMode(mode);
  const resolvedColor = color ?? (resolvedMode === "dark" ? "white" : "black");
  const visibleLabel =
    buttonText ??
    (variant === "provider" ? "Apple" : autharaButtonLabel(label, "Apple"));

  return (
    <ProviderButton
      {...buttonProps}
      provider="apple"
      providerLabel="Apple"
      action={action}
      audience={audience}
      authenticationChallengeId={authenticationChallengeId}
      recoveryLinkId={recoveryLinkId}
      onSuccess={onSuccess}
      onError={onError}
      onCancel={onCancel}
      variant={variant}
      label={visibleLabel}
      appearance={appleButtonAppearance({
        variant,
        size,
        width,
        color: resolvedColor,
        border,
        borderRadius,
        align,
      })}
    />
  );
}

export function MicrosoftButton(props: MicrosoftButtonProps) {
  const internal = props as MicrosoftButtonVisualProps &
    InternalActionProps<"microsoft">;
  const {
    action = "login",
    audience,
    authenticationChallengeId,
    recoveryLinkId,
    onSuccess,
    onError,
    onCancel,
    variant = "text",
    size = "large",
    label = action === "login" ? "sign-in" : "continue",
    mode = "light",
    border,
    align = "center",
    buttonText,
    width,
    ...buttonProps
  } = internal;
  const resolvedMode = useResolvedColorMode(mode);
  const visibleLabel =
    buttonText ??
    (variant === "provider"
      ? "Microsoft"
      : autharaButtonLabel(label, "Microsoft"));

  return (
    <ProviderButton
      {...buttonProps}
      provider="microsoft"
      providerLabel="Microsoft"
      action={action}
      audience={audience}
      authenticationChallengeId={authenticationChallengeId}
      recoveryLinkId={recoveryLinkId}
      onSuccess={onSuccess}
      onError={onError}
      onCancel={onCancel}
      variant={variant}
      label={visibleLabel}
      appearance={microsoftButtonAppearance({
        variant,
        size,
        width,
        mode: resolvedMode,
        border,
        align,
      })}
    />
  );
}

function ProviderIcon({
  provider,
  color,
}: {
  provider: AutharaProviderName;
  color: string;
}) {
  if (provider === "google") return <GoogleLogo />;
  if (provider === "microsoft") return <MicrosoftLogo />;
  return <AppleLogo color={color} />;
}

function GoogleLogo() {
  return (
    <Svg accessibilityElementsHidden width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.613Z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.468-.806 5.956-2.182l-2.91-2.258c-.805.54-1.835.86-3.046.86-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
      />
      <Path
        fill="#FBBC05"
        d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.507.454 3.44 1.345l2.581-2.58C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
      />
    </Svg>
  );
}

function AppleLogo({ color }: { color: string }) {
  return (
    <Svg
      accessibilityElementsHidden
      width={16}
      height={20}
      viewBox="0 0 814 1000"
    >
      <Path
        fill={color}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </Svg>
  );
}

function MicrosoftLogo() {
  return (
    <Svg accessibilityElementsHidden width={18} height={18} viewBox="0 0 18 18">
      <Rect width={8.5} height={8.5} fill="#f25022" />
      <Rect x={9.5} width={8.5} height={8.5} fill="#7fba00" />
      <Rect y={9.5} width={8.5} height={8.5} fill="#00a4ef" />
      <Rect x={9.5} y={9.5} width={8.5} height={8.5} fill="#ffb900" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { gap: 7 },
  button: {
    position: "relative",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    overflow: "hidden",
  },
  iconSlot: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, lineHeight: 20 },
  error: {
    color: "#ff9d8e",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.62 },
});
