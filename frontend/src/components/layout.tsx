import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Icon } from "@/src/components/ui";

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: {
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
  },
  titleWrap: { flex: 1 },
  title: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  subtitle: { color: c.muted, fontSize: 12.5, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
}));

export function Screen({ children }: { children: React.ReactNode }) {
  const s = useStyles();
  return <View style={s.screen}>{children}</View>;
}

export function AppHeader({
  title,
  subtitle,
  showBack,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.headerRow}>
        {showBack ? (
          <Pressable
            testID="header-back-button"
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={6}
          >
            <Icon name="chevron-left" size={26} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <View style={s.titleWrap}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={s.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={s.right}>{right}</View> : null}
      </View>
    </View>
  );
}
