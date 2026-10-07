// ZenRadius — Navy Cyberpunk theme. Dark, enterprise, futuristic.
// Keys mirror the `color` block of design_guidelines.json. Use pairs
// (surface / onSurface). Build sheets with makeStyles(); read useTheme().colors
// for color props. Never write color literals in components.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const navy = {
  // Surfaces
  surface: "#070C1A", // deep navy canvas
  onSurface: "#E9F0FF",
  surfaceSecondary: "#0F1A30", // cards
  onSurfaceSecondary: "#C9D6F0",
  surfaceTertiary: "#152339", // inputs, chips
  onSurfaceTertiary: "#9DB0D6",
  surfaceInverse: "#E9F0FF",
  onSurfaceInverse: "#070C1A",
  muted: "#6B7CA3", // captions, placeholders

  // Brand — electric blue / cyan
  brand: "#2E8DFF",
  onBrand: "#04122B",
  brandPrimary: "#2E8DFF",
  onBrandPrimary: "#04122B",
  brandSecondary: "#16233F",
  onBrandSecondary: "#9FD0FF",
  brandTertiary: "#0E2033",
  onBrandTertiary: "#5FD0FF",

  // Accent cyan + glow (extra tokens)
  accent: "#22D3EE",
  onAccent: "#042029",
  glow: "#2E8DFF",
  gradientStart: "#123A6B",
  gradientMid: "#0B1C3A",
  gradientEnd: "#070C1A",
  overlay: "rgba(3,8,20,0.72)",

  // Status
  success: "#2BD98A",
  onSuccess: "#04210F",
  warning: "#F6A609",
  onWarning: "#241400",
  error: "#FF5A72",
  onError: "#2A0710",
  info: "#49B9FF",
  onInfo: "#021326",

  // Lines
  border: "#1C2B49",
  borderStrong: "#2E8DFF",
  divider: "#15223B",
};

export type ThemeColors = typeof navy;

export const defaultScheme = "dark" satisfies ColorScheme;

// Both schemes use the navy palette so the app looks identical regardless of
// the device setting (navy cyberpunk is the fixed brand identity).
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light: navy, dark: navy };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
