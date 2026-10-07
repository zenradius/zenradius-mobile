import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, EmptyState, ErrorView, Icon, LoadingView, TextField } from "@/src/components/ui";
import { Chips } from "@/src/components/chips";
import { useAuth } from "@/src/context/AuthContext";
import { rupiah, statusLabel } from "@/src/format";
import { STAFF_ROLES } from "@/src/navigation";

const useStyles = makeStyles((c) => ({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
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
  { value: "", label: "Semua" },
  { value: "unpaid", label: "Belum Bayar" },
  { value: "paid", label: "Lunas" },
];

export default function InvoicesScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { api, role } = useAuth();
  const isStaff = role ? STAFF_ROLES.includes(role) : false;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const query = useQuery({
    queryKey: ["invoices", q, status],
    queryFn: () => api.get("/api/mobile/v1/invoices", { q, status, limit: 300 }),
  });

  const items = query.data?.items || [];

  return (
    <Screen>
      <AppHeader title="Tagihan" subtitle={`${items.length} ditampilkan`} />
      {isStaff ? (
        <View style={s.searchWrap}>
          <TextField
            testID="invoice-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Cari nama pelanggan"
            leftIcon="magnify"
          />
        </View>
      ) : null}
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
          ListEmptyComponent={<EmptyState icon="receipt-text-outline" title="Tidak ada tagihan" />}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/invoice/${item.id}`)} testID={`invoice-row-${item.id}`}>
              <View style={s.avatar}>
                <Icon name={item.status === "paid" ? "cash-check" : "file-document-alert"} size={22} color={item.status === "paid" ? colors.success : colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{isStaff ? item.customerName || "Pelanggan" : item.periodText}</Text>
                <Text style={s.sub} numberOfLines={1}>{isStaff ? item.periodText : item.packageName || "Tagihan"}</Text>
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
