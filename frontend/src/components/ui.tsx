import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type IconName = React.ComponentProps<typeof MaterialDesignIcons>["name"];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <MaterialDesignIcons name={name} size={size} color={color ?? colors.onSurface} />;
}

export const LOGO = require("../../assets/logo.png");

export function Logo({ width = 180 }: { width?: number }) {
  const height = width * (695 / 2106);
  return <Image source={LOGO} style={{ width, height }} contentFit="contain" />;
}

// --------------------------------------------------------------------------- Card
const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
  },
}));

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  const s = useCardStyles();
  return (
    <View style={[s.card, style]} testID={testID}>
      {children}
    </View>
  );
}

// --------------------------------------------------------------------------- Button
const useBtnStyles = makeStyles((c) => ({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.error },
  textPrimary: { color: c.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  textSecondary: { color: c.onSurface, fontSize: 16, fontWeight: "600" },
  textGhost: { color: c.brand, fontSize: 15, fontWeight: "600" },
  textDanger: { color: c.error, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
}));

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  testID?: string;
  style?: ViewStyle;
}) {
  const s = useBtnStyles();
  const { colors } = useTheme();
  const txtStyle =
    variant === "primary"
      ? s.textPrimary
      : variant === "danger"
        ? s.textDanger
        : variant === "ghost"
          ? s.textGhost
          : s.textSecondary;
  const iconColor =
    variant === "primary" ? colors.onBrandPrimary : variant === "danger" ? colors.error : colors.onSurface;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.base,
        s[variant],
        isDisabled && s.disabled,
        pressed && !isDisabled && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={iconColor} /> : null}
          <Text style={txtStyle}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// --------------------------------------------------------------------------- TextField
const useFieldStyles = makeStyles((c) => ({
  wrap: { gap: spacing.sm },
  label: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: c.onSurface, fontSize: 16, paddingVertical: 14 },
  focused: { borderColor: c.borderStrong },
  error: { color: c.error, fontSize: 12 },
  iconBtn: { padding: spacing.xs },
}));

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secure,
  leftIcon,
  autoCapitalize = "none",
  keyboardType,
  testID,
  ...rest
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string | null;
  secure?: boolean;
  leftIcon?: IconName;
  testID?: string;
} & Pick<TextInputProps, "autoCapitalize" | "keyboardType">) {
  const s = useFieldStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  const [hidden, setHidden] = React.useState(!!secure);
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputWrap, focused && s.focused, !!error && { borderColor: colors.error }]}>
        {leftIcon ? <Icon name={leftIcon} size={18} color={colors.muted} /> : null}
        <TextInput
          testID={testID}
          style={[s.input, leftIcon ? { marginLeft: spacing.sm } : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={hidden}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secure ? (
          <Pressable
            testID={testID ? `${testID}-toggle` : undefined}
            style={s.iconBtn}
            onPress={() => setHidden((h) => !h)}
          >
            <Icon name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

// --------------------------------------------------------------------------- Badge
const useBadgeStyles = makeStyles((c) => ({
  base: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
}));

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "info" | "muted"> = {
  active: "success",
  paid: "success",
  resolved: "success",
  suspended: "error",
  unpaid: "error",
  inactive: "muted",
  open: "info",
  in_progress: "warning",
};

export function Badge({ label, tone, status }: { label: string; tone?: "success" | "warning" | "error" | "info" | "muted"; status?: string }) {
  const s = useBadgeStyles();
  const { colors } = useTheme();
  const t = tone ?? (status ? STATUS_TONE[status] ?? "muted" : "muted");
  const map = {
    success: { bg: colors.success, fg: colors.onSuccess },
    warning: { bg: colors.warning, fg: colors.onWarning },
    error: { bg: colors.error, fg: colors.onError },
    info: { bg: colors.info, fg: colors.onInfo },
    muted: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
  }[t];
  return (
    <View style={[s.base, { backgroundColor: map.bg }]}>
      <Text style={[s.text, { color: map.fg }]}>{label}</Text>
    </View>
  );
}

// --------------------------------------------------------------------------- StatCard
const useStatStyles = makeStyles((c) => ({
  card: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: "hidden",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.brandTertiary,
  },
  value: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  label: { color: c.muted, fontSize: 12.5, fontWeight: "500" },
}));

export function StatCard({
  icon,
  value,
  label,
  tint,
  testID,
}: {
  icon: IconName;
  value: string | number;
  label: string;
  tint?: string;
  testID?: string;
}) {
  const s = useStatStyles();
  const { colors } = useTheme();
  return (
    <View style={s.card} testID={testID}>
      <View style={[s.iconWrap, tint ? { backgroundColor: tint + "22" } : null]}>
        <Icon name={icon} size={20} color={tint ?? colors.accent} />
      </View>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

// --------------------------------------------------------------------------- SectionTitle
const useSectionStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { color: c.onSurface, fontSize: 16, fontWeight: "700" },
  action: { color: c.brand, fontSize: 13, fontWeight: "600" },
}));

export function SectionTitle({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  const s = useSectionStyles();
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// --------------------------------------------------------------------------- States
const useStateStyles = makeStyles((c) => ({
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md },
  title: { color: c.onSurface, fontSize: 16, fontWeight: "700", textAlign: "center" },
  sub: { color: c.muted, fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceTertiary,
  },
}));

export function LoadingView({ label }: { label?: string }) {
  const s = useStateStyles();
  const { colors } = useTheme();
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.brand} />
      {label ? <Text style={s.sub}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = "inbox-outline", title, subtitle }: { icon?: IconName; title: string; subtitle?: string }) {
  const s = useStateStyles();
  const { colors } = useTheme();
  return (
    <View style={s.center}>
      <View style={s.iconWrap}>
        <Icon name={icon} size={30} color={colors.muted} />
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const s = useStateStyles();
  const { colors } = useTheme();
  return (
    <View style={s.center}>
      <View style={s.iconWrap}>
        <Icon name="wifi-off" size={28} color={colors.error} />
      </View>
      <Text style={s.title}>Gagal memuat</Text>
      <Text style={s.sub}>{message}</Text>
      {onRetry ? <Button title="Coba Lagi" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

// --------------------------------------------------------------------------- Gradient backdrop
export function GradientBackdrop({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export { ScrollView };
