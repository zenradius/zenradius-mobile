import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, Button, Card, EmptyState, Icon, LoadingView, SectionTitle, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { rupiah } from "@/src/format";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  label: { color: c.muted, fontSize: 13 },
  balance: { color: c.onSurface, fontSize: 32, fontWeight: "900" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.brandTertiary,
  },
  rowTitle: { color: c.onSurface, fontSize: 14.5, fontWeight: "600" },
  rowSub: { color: c.muted, fontSize: 12.5, marginTop: 1 },
  amount: { color: c.onSurface, fontSize: 14.5, fontWeight: "700" },
  lookupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
}));

export default function ResellerScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { api } = useAuth();
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: () => api.get("/api/mobile/v1/me") });
  const tx = useQuery({ queryKey: ["reseller-tx"], queryFn: () => api.get("/api/mobile/v1/reseller/transactions", { limit: 100 }) });

  const [q, setQ] = useState("");
  const [lookup, setLookup] = useState<any[] | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [busyLookup, setBusyLookup] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const onLookup = async () => {
    setLookupErr(null);
    setBanner(null);
    if (q.trim().length < 4) {
      setLookupErr("Kata kunci minimal 4 karakter.");
      return;
    }
    setBusyLookup(true);
    try {
      const r = await api.get("/api/mobile/v1/reseller/invoice-lookup", { q: q.trim() });
      setLookup(r.items || []);
    } catch (e: any) {
      setLookupErr(e?.message || "Gagal mencari tagihan.");
      setLookup(null);
    } finally {
      setBusyLookup(false);
    }
  };

  const payMutation = useMutation({
    mutationFn: (invoiceId: number) => api.post("/api/mobile/v1/reseller/pay-invoice", { invoiceId }),
    onSuccess: () => {
      setBanner({ ok: true, text: "Tagihan berhasil dibayar." });
      setLookup((prev) => prev);
      qc.invalidateQueries({ queryKey: ["reseller-tx"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onLookup();
    },
    onError: (e: any) => setBanner({ ok: false, text: e?.message || "Pembayaran gagal." }),
  });

  const transactions = tx.data?.items || [];

  return (
    <Screen>
      <AppHeader title="Transaksi Reseller" subtitle="Saldo & pembayaran tagihan" />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={tx.isFetching && !tx.isLoading} onRefresh={() => { tx.refetch(); me.refetch(); }} tintColor={colors.brand} />}
      >
        <Card>
          <Text style={s.label}>Saldo Tersedia</Text>
          <Text style={s.balance} testID="reseller-balance">{rupiah(me.data?.balance)}</Text>
          <Text style={s.rowSub}>Biaya admin per tagihan: {rupiah(me.data?.billingFee)}</Text>
        </Card>

        <Card>
          <SectionTitle title="Bayar Tagihan Pelanggan" />
          <TextField
            testID="reseller-lookup-input"
            value={q}
            onChangeText={setQ}
            placeholder="Nama / telepon pelanggan (min 4 huruf)"
            leftIcon="account-search"
            error={lookupErr}
          />
          <View style={{ height: spacing.sm }} />
          <Button testID="reseller-lookup-button" title="Cari Tagihan" icon="magnify" variant="secondary" onPress={onLookup} loading={busyLookup} />

          {banner ? (
            <View style={[s.banner, { backgroundColor: (banner.ok ? colors.success : colors.error) + "22", marginTop: spacing.md }]} testID="reseller-pay-banner">
              <Icon name={banner.ok ? "check-circle" : "alert-circle"} size={20} color={banner.ok ? colors.success : colors.error} />
              <Text style={[s.bannerText, { color: banner.ok ? colors.success : colors.error }]}>{banner.text}</Text>
            </View>
          ) : null}

          {lookup !== null ? (
            lookup.length === 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <EmptyState icon="file-search-outline" title="Tidak ada tagihan belum bayar" />
              </View>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                {lookup.map((inv) => (
                  <View key={inv.id} style={s.lookupRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{inv.customerName || "Pelanggan"}</Text>
                      <Text style={s.rowSub}>{inv.periodText} · {rupiah(inv.amount)}</Text>
                    </View>
                    <Button
                      testID={`reseller-pay-${inv.id}`}
                      title="Bayar"
                      icon="cash"
                      onPress={() => payMutation.mutate(inv.id)}
                      loading={payMutation.isPending}
                      style={{ height: 42, paddingHorizontal: spacing.lg }}
                    />
                  </View>
                ))}
              </View>
            )
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="Riwayat Transaksi" />
          {tx.isLoading ? (
            <LoadingView />
          ) : transactions.length === 0 ? (
            <EmptyState icon="swap-horizontal" title="Belum ada transaksi" />
          ) : (
            transactions.map((t: any) => (
              <View key={t.id} style={s.listRow}>
                <View style={s.avatar}>
                  <Icon name={t.type === "topup" ? "wallet-plus" : "cash"} size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{t.customer_name || (t.type === "topup" ? "Top Up Saldo" : "Transaksi")}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>{t.note || t.type}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.amount}>{rupiah(t.amount_buy)}</Text>
                  <Badge label={`Saldo ${rupiah(t.balance_after)}`} tone="muted" />
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
