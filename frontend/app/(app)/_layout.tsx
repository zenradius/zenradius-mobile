import React from "react";
import { Platform } from "react-native";
import { Redirect, Tabs } from "expo-router";

import { useTheme } from "@/src/theme";
import { Icon } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { ALL_ROUTES, ROLE_TABS, TabRoute } from "@/src/navigation";

export default function AppLayout() {
  const { colors } = useTheme();
  const { status, role } = useAuth();

  if (status === "signedOut" || !role) return <Redirect href="/" />;

  const menu = ROLE_TABS[role];
  const byRoute = new Map<TabRoute, (typeof menu)[number]>();
  menu.forEach((m) => byRoute.set(m.name, m));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      {ALL_ROUTES.map((route) => {
        const item = byRoute.get(route);
        return (
          <Tabs.Screen
            key={route}
            name={route}
            options={{
              href: item ? undefined : null,
              title: item?.label ?? route,
              tabBarIcon: ({ color, size }) => (
                <Icon name={(item?.icon ?? "circle-outline") as any} size={size ?? 22} color={color} />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
