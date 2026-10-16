import type { DimensionValue, TextStyle } from "react-native";

import type {
  AutharaButtonLabel,
  AutharaButtonSize,
  AutharaButtonVariant,
} from "./buttons.js";

export type ButtonAppearance = {
  height: number;
  width: DimensionValue;
  fill: string;
  text: string;
  border: string;
  borderRadius: number;
  borderWidth: number;
  fontFamily: string;
  fontWeight: TextStyle["fontWeight"];
  horizontalPadding: number;
  iconLeft?: number;
};

const textButtonHeights: Record<AutharaButtonSize, number> = {
  small: 30,
  medium: 36,
  large: 44,
};

const iconButtonSizes: Record<AutharaButtonSize, number> = {
  small: 36,
  medium: 44,
  large: 52,
};

export function autharaButtonLabel(
  label: AutharaButtonLabel,
  provider: string,
): string {
  switch (label) {
    case "sign-in":
      return `Sign in with ${provider}`;
    case "sign-up":
      return `Sign up with ${provider}`;
    case "continue":
      return `Continue with ${provider}`;
  }
}

function dimensions(
  variant: AutharaButtonVariant,
  size: AutharaButtonSize,
  width: DimensionValue | undefined,
) {
  const height =
    variant === "icon" ? iconButtonSizes[size] : textButtonHeights[size];
  return { height, width: width ?? (variant === "icon" ? height : "100%") };
}

export function googleButtonAppearance(options: {
  variant: AutharaButtonVariant;
  size: AutharaButtonSize;
  width?: DimensionValue;
  mode: "light" | "dark";
  theme?: "light" | "dark" | "neutral";
  border?: boolean;
  shape: "pill" | "circle" | "square" | "rectangular";
  logoAlignment: "left" | "center";
}): ButtonAppearance {
  const { height, width } = dimensions(
    options.variant,
    options.size,
    options.width,
  );
  const resolvedTheme = options.theme ?? "light";
  const palette = {
    light: { fill: "#ffffff", text: "#1f1f1f", border: "#747775" },
    dark: { fill: "#131314", text: "#e3e3e3", border: "#8e918f" },
    neutral: {
      fill: "#f2f2f2",
      text: "#1f1f1f",
      border: "transparent",
    },
  }[resolvedTheme];
  const borderRadius =
    options.shape === "circle" || options.shape === "pill"
      ? height / 2
      : options.shape === "square"
        ? 6
        : 12;
  const showBorder =
    options.border ??
    (options.theme === undefined
      ? options.mode === "light"
      : resolvedTheme !== "neutral");

  return {
    height,
    width,
    fill: palette.fill,
    text: palette.text,
    border: showBorder ? palette.border : "transparent",
    borderRadius,
    borderWidth: showBorder ? 1 : 0,
    fontFamily: "Arial",
    fontWeight: "500",
    horizontalPadding: 12,
    iconLeft:
      options.variant !== "icon" && options.logoAlignment === "left"
        ? 12
        : undefined,
  };
}

export function appleButtonAppearance(options: {
  variant: AutharaButtonVariant;
  size: AutharaButtonSize;
  width?: DimensionValue;
  color: "black" | "white";
  border: boolean;
  borderRadius: number;
  align: "left" | "center";
}): ButtonAppearance {
  if (
    !Number.isFinite(options.borderRadius) ||
    options.borderRadius < 0 ||
    options.borderRadius > 50
  ) {
    throw new RangeError("Apple button borderRadius must be between 0 and 50.");
  }
  const { height, width } = dimensions(
    options.variant,
    options.size,
    options.width,
  );

  return {
    height,
    width,
    fill: options.color === "black" ? "#000000" : "#ffffff",
    text: options.color === "black" ? "#ffffff" : "#202124",
    border:
      options.border && options.color === "black"
        ? "#000000"
        : options.border
          ? "#9aa0a6"
          : "transparent",
    borderRadius: options.borderRadius,
    borderWidth: 1,
    fontFamily: "Arial",
    fontWeight: "500",
    horizontalPadding: 14,
    iconLeft:
      options.variant !== "icon" && options.align === "left" ? 14 : undefined,
  };
}

export function microsoftButtonAppearance(options: {
  variant: AutharaButtonVariant;
  size: AutharaButtonSize;
  width?: DimensionValue;
  mode: "light" | "dark";
  border?: boolean;
  align: "left" | "center";
}): ButtonAppearance {
  const { height, width } = dimensions(
    options.variant,
    options.size,
    options.width,
  );
  const showBorder = options.border ?? options.mode === "light";

  return {
    height,
    width,
    fill: "#ffffff",
    text: "#1f1f1f",
    border: showBorder ? "#8c8c8c" : "transparent",
    borderRadius: 12,
    borderWidth: showBorder ? 1 : 0,
    fontFamily: "Arial",
    fontWeight: "600",
    horizontalPadding: 12,
    iconLeft:
      options.variant !== "icon" && options.align === "left" ? 12 : undefined,
  };
}
