import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, EmptyState, ErrorView, Icon, LoadingView } from "@/src/components/ui";
import { Chips } from "@/src/components/chips";
import { useAuth } from "@/src/context/AuthContext";
import { formatDate, statusLabel } from "@/src/format";
import { STAFF_ROLES, usesNativeTabs } from "@/src/navigation";

const useStyles = makeStyles((c) => ({
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: 96 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.brandTertiary,
  },
  title: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  sub: { color: c.muted, fontSize: 12.5, marginTop: 1 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: c.glow,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 15 },
}));

const STAFF_OPTS = [
  { value: "", label: "Semua" },
  { value: "open", label: "Baru" },
  { value: "in_progress", label: "Dikerjakan" },
  { value: "resolved", label: "Selesai" },
];
const TECH_OPTS = [
  { value: "assigned", label: "Tugas Saya" },
  { value: "pool", label: "Pool Terbuka" },
  { value: "history", label: "Riwayat" },
];

export default function TicketsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { api, role } = useAuth();
  const params = useLocalSearchParams<{ scope?: string }>();
  const isStaff = role ? STAFF_ROLES.includes(role) : false;
  const isTech = role === "teknisi";
  const canCreate = isStaff || role === "pelanggan";

  const [status, setStatus] = useState("");
  const [scope, setScope] = useState(params.scope === "pool" ? "pool" : "assigned");

  const query = useQuery({
    queryKey: ["tickets", role, status, scope],
    queryFn: () =>
      api.get("/api/mobile/v1/tickets", isTech ? { scope } : { status }),
  });

  const items = query.data?.items || [];
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  return (
    <Screen>
      <AppHeader title={isTech ? "Tugas" : "Tiket"} subtitle={`${items.length} tiket`} />
      {isStaff ? <Chips options={STAFF_OPTS} value={status} onChange={setStatus} /> : null}
      {isTech ? <Chips options={TECH_OPTS} value={scope} onChange={setScope} /> : null}

      {query.isLoading ? (
        <LoadingView />
      ) : query.isError ? (
        <ErrorView message={(query.error as any)?.message || "Gagal memuat"} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={query.isFetching && !query.isLoading}
          onRefresh={() => query.refetch()}
          ListEmptyComponent={<EmptyState icon="ticket-outline" title="Tidak ada tiket" subtitle={canCreate ? "Buat tiket baru dengan tombol di bawah." : undefined} />}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/ticket/${item.id}`)} testID={`ticket-row-${item.id}`}>
              <View style={s.avatar}>
                <Icon name="ticket-confirmation" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{item.subject}</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {item.customerName || "Pelanggan"} · {formatDate(item.createdAt)}
                </Text>
              </View>
              <Badge label={statusLabel(item.status)} status={item.status} />
            </Pressable>
          )}
        />
      )}

      {canCreate ? (
        <Pressable
          testID="create-ticket-fab"
          style={[s.fab, { bottom: bottomChrome + 16 }]}
          onPress={() => router.push("/ticket/new")}
        >
          <Icon name="plus" size={22} color={colors.onBrandPrimary} />
          <Text style={s.fabText}>Buat Tiket</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
