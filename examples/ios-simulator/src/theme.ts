import { DynamicColorIOS, Platform, type ColorValue } from "react-native";

function adaptive(light: string, dark: string): ColorValue {
  return Platform.OS === "ios" ? DynamicColorIOS({ light, dark }) : dark;
}

export const colors = {
  ink: adaptive("#F4F7F4", "#07110F"),
  surface: adaptive("#FFFFFF", "#0E1C19"),
  surfaceRaised: adaptive("#E8EFEA", "#142622"),
  line: adaptive("#CBD7D0", "#284039"),
  text: adaptive("#12221D", "#F2F5EB"),
  muted: adaptive("#60736A", "#9CB0A8"),
  accent: adaptive("#78C85A", "#B7F397"),
  accentInk: adaptive("#10200D", "#11200D"),
  danger: adaptive("#B42318", "#FF9D8E"),
  warning: adaptive("#8A5A00", "#F4CB72"),
  dangerBorder: adaptive("#F2B8B5", "#653C35"),
  dangerSurface: adaptive("#FFF1F0", "#251715"),
  dangerMessage: adaptive("#7A271A", "#EBC2BB"),
  successBorder: adaptive("#A8D5A2", "#375D31"),
  successSurface: adaptive("#EFF8EC", "#152615"),
  successMessage: adaptive("#285D21", "#CDE8C2"),
  successPill: adaptive("#E6F4E3", "#213920"),
  warningPill: adaptive("#FFF3D6", "#3A2E18"),
  dangerButtonBorder: adaptive("#E8A8A0", "#64372F"),
  dangerButtonSurface: adaptive("#FFF1F0", "#261816"),
  white: "#FFFFFF",
};

export const typography = {
  display: Platform.select({ ios: "Avenir Next", default: "sans-serif" }),
  body: Platform.select({ ios: "System", default: "sans-serif" }),
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
};

export const radius = {
  small: 10,
  medium: 16,
  large: 24,
};
