import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, EmptyState, ErrorView, Icon, LoadingView } from "@/src/components/ui";
import { Chips } from "@/src/components/chips";
import { useAuth } from "@/src/context/AuthContext";
import { rupiah, statusLabel } from "@/src/format";

const useStyles = makeStyles((c) => ({
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: spacing.xxl },
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
  amount: { color: c.onSurface, fontSize: 15, fontWeight: "800" },
}));

const STATUS_OPTS = [
  { value: "unpaid", label: "Belum Bayar" },
  { value: "paid", label: "Lunas" },
  { value: "", label: "Semua" },
];

export default function CollectionsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { api } = useAuth();
  const [status, setStatus] = useState("unpaid");

  const query = useQuery({
    queryKey: ["collections", status],
    queryFn: () => api.get("/api/mobile/v1/invoices", { status, limit: 300 }),
  });

  const items = query.data?.items || [];

  return (
    <Screen>
      <AppHeader title="Penagihan" subtitle={`${items.length} tagihan di area Anda`} />
      <Chips options={STATUS_OPTS} value={status} onChange={setStatus} />
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
          ListEmptyComponent={<EmptyState icon="cash-multiple" title="Tidak ada tagihan" subtitle="Belum ada tagihan untuk area Anda." />}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/invoice/${item.id}`)} testID={`collection-row-${item.id}`}>
              <View style={s.avatar}>
                <Icon name="account-cash" size={22} color={item.status === "paid" ? colors.success : colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{item.customerName || "Pelanggan"}</Text>
                <Text style={s.sub} numberOfLines={1}>{item.periodText}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={s.amount}>{rupiah(item.amount)}</Text>
                <Badge label={statusLabel(item.status)} status={item.status} />
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
