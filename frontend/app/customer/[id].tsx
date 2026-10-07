import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, Button, Card, EmptyState, ErrorView, Icon, LoadingView, SectionTitle } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { formatDate, rupiah, speedLabel, statusLabel } from "@/src/format";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  avatar: {
    width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center",
    backgroundColor: c.brandTertiary, borderWidth: 2, borderColor: c.borderStrong,
  },
  name: { color: c.onSurface, fontSize: 19, fontWeight: "800" },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  label: { color: c.muted, fontSize: 13.5 },
  value: { color: c.onSurface, fontSize: 14.5, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  rowTitle: { color: c.onSurface, fontSize: 14.5, fontWeight: "600" },
  rowSub: { color: c.muted, fontSize: 12.5 },
  rowAmount: { color: c.onSurface, fontSize: 14.5, fontWeight: "700" },
  iconBox: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.brandTertiary },
}));

export default function CustomerDetailScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();

  const query = useQuery({ queryKey: ["customer", id], queryFn: () => api.get(`/api/mobile/v1/customers/${id}`) });
  const c = query.data?.customer;
  const unpaid = query.data?.unpaidInvoices || [];
  const tickets = query.data?.tickets || [];

  return (
    <Screen>
      <AppHeader title="Detail Pelanggan" showBack />
      {query.isLoading ? (
        <LoadingView />
      ) : query.isError || !c ? (
        <ErrorView message={(query.error as any)?.message || "Pelanggan tidak ditemukan"} onRetry={() => query.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <View style={s.avatar}><Icon name="account" size={36} color={colors.accent} /></View>
            <Text style={s.name}>{c.name}</Text>
            <Badge label={statusLabel(c.status)} status={c.status} />
          </View>

          <Card>
            <SectionTitle title="Informasi" />
            <View style={s.infoRow}><Text style={s.label}>Telepon</Text><Text style={s.value}>{c.phone || "-"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>Alamat</Text><Text style={s.value}>{c.address || "-"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>Area</Text><Text style={s.value}>{c.area || "-"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>Paket</Text><Text style={s.value}>{c.packageName || "-"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>PPPoE</Text><Text style={s.value}>{c.pppoeUsername || "-"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>Aktif hingga</Text><Text style={s.value}>{formatDate(c.expiredAt)}</Text></View>
          </Card>

          <Card>
            <SectionTitle title={`Tagihan Belum Bayar (${unpaid.length})`} />
            {unpaid.length === 0 ? (
              <EmptyState icon="check-circle-outline" title="Tidak ada tunggakan" />
            ) : (
              unpaid.map((inv: any) => (
                <Pressable key={inv.id} style={s.listRow} onPress={() => router.push(`/invoice/${inv.id}`)} testID={`cust-invoice-${inv.id}`}>
                  <View style={s.iconBox}><Icon name="file-document-alert" size={18} color={colors.error} /></View>
                  <View style={{ flex: 1 }}><Text style={s.rowTitle}>{inv.periodText}</Text><Text style={s.rowSub}>Belum bayar</Text></View>
                  <Text style={[s.rowAmount, { color: colors.error }]}>{rupiah(inv.amount)}</Text>
                </Pressable>
              ))
            )}
          </Card>

          <Card>
            <SectionTitle title={`Tiket (${tickets.length})`} />
            {tickets.length === 0 ? (
              <EmptyState icon="ticket-outline" title="Belum ada tiket" />
            ) : (
              tickets.map((t: any) => (
                <Pressable key={t.id} style={s.listRow} onPress={() => router.push(`/ticket/${t.id}`)} testID={`cust-ticket-${t.id}`}>
                  <View style={s.iconBox}><Icon name="ticket-confirmation" size={18} color={colors.accent} /></View>
                  <View style={{ flex: 1 }}><Text style={s.rowTitle} numberOfLines={1}>{t.subject}</Text><Text style={s.rowSub}>{formatDate(t.createdAt)}</Text></View>
                  <Badge label={statusLabel(t.status)} status={t.status} />
                </Pressable>
              ))
            )}
          </Card>

          <Button testID="create-ticket-for-customer" title="Buat Tiket untuk Pelanggan" icon="ticket-plus" variant="secondary" onPress={() => router.push(`/ticket/new?customerId=${c.id}`)} />
        </ScrollView>
      )}
    </Screen>
  );
}
