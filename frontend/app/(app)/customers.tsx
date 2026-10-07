import React, { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, EmptyState, ErrorView, Icon, LoadingView, TextField } from "@/src/components/ui";
import { Chips } from "@/src/components/chips";
import { useAuth } from "@/src/context/AuthContext";
import { statusLabel } from "@/src/format";

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
  name: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  sub: { color: c.muted, fontSize: 12.5, marginTop: 1 },
}));

const STATUS_OPTS = [
  { value: "", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "suspended", label: "Isolir" },
  { value: "inactive", label: "Nonaktif" },
];

export default function CustomersScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { api } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const query = useQuery({
    queryKey: ["customers", q, status],
    queryFn: () => api.get("/api/mobile/v1/customers", { q, status, limit: 200 }),
  });

  const items = query.data?.items || [];

  return (
    <Screen>
      <AppHeader title="Pelanggan" subtitle={`${items.length} ditampilkan`} />
      <View style={s.searchWrap}>
        <TextField
          testID="customer-search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Cari nama atau telepon"
          leftIcon="magnify"
        />
      </View>
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
          ListEmptyComponent={<EmptyState icon="account-search-outline" title="Pelanggan tidak ditemukan" />}
          renderItem={({ item }) => (
            <Pressable style={s.row} onPress={() => router.push(`/customer/${item.id}`)} testID={`customer-row-${item.id}`}>
              <View style={s.avatar}>
                <Icon name="account" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {item.phone || "-"} · {item.area || "-"}
                </Text>
              </View>
              <Badge label={statusLabel(item.status)} status={item.status} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
