import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, Button, Card, ErrorView, Icon, LoadingView, SectionTitle } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { formatDateTime, rupiah, statusLabel } from "@/src/format";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  amountCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  amount: { color: c.onSurface, fontSize: 36, fontWeight: "900" },
  period: { color: c.muted, fontSize: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  label: { color: c.muted, fontSize: 13.5 },
  value: { color: c.onSurface, fontSize: 14.5, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
}));

export default function InvoiceDetailScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, role } = useAuth();
  const qc = useQueryClient();
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.get(`/api/mobile/v1/invoices/${id}`),
  });
  const inv = query.data?.invoice;

  const canMarkPaid = role === "admin" || role === "customer_service" || role === "kolektor";

  const payMutation = useMutation({
    mutationFn: () => api.post(`/api/mobile/v1/invoices/${id}/pay`, { notes: "Dibayar via mobile" }),
    onSuccess: () => {
      setBanner({ ok: true, text: "Tagihan ditandai lunas." });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => setBanner({ ok: false, text: e?.message || "Gagal memproses pembayaran." }),
  });

  const onlinePay = useMutation({
    mutationFn: () => api.get(`/api/mobile/v1/invoices/${id}/payment-link`),
    onSuccess: async (data: any) => {
      if (data?.url) await WebBrowser.openBrowserAsync(data.url);
    },
    onError: (e: any) => setBanner({ ok: false, text: e?.message || "Pembayaran online belum tersedia." }),
  });

  return (
    <Screen>
      <AppHeader title="Detail Tagihan" showBack />
      {query.isLoading ? (
        <LoadingView />
      ) : query.isError || !inv ? (
        <ErrorView message={(query.error as any)?.message || "Tagihan tidak ditemukan"} onRetry={() => query.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={s.amountCard}>
              <Badge label={statusLabel(inv.status)} status={inv.status} />
              <Text style={s.amount}>{rupiah(inv.amount)}</Text>
              <Text style={s.period}>Periode {inv.periodText}</Text>
            </View>
          </Card>

          <Card>
            <SectionTitle title="Rincian" />
            <View style={s.infoRow}><Text style={s.label}>Pelanggan</Text><Text style={s.value}>{inv.customerName || "-"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>Paket</Text><Text style={s.value}>{inv.packageName || "-"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>Status</Text><Text style={s.value}>{statusLabel(inv.status)}</Text></View>
            {inv.status === "paid" ? (
              <>
                <View style={s.infoRow}><Text style={s.label}>Dibayar pada</Text><Text style={s.value}>{formatDateTime(inv.paidAt)}</Text></View>
                <View style={s.infoRow}><Text style={s.label}>Diproses oleh</Text><Text style={s.value}>{inv.paidByName || "-"}</Text></View>
              </>
            ) : null}
          </Card>

          {banner ? (
            <View style={[s.banner, { backgroundColor: (banner.ok ? colors.success : colors.error) + "22" }]} testID="invoice-banner">
              <Icon name={banner.ok ? "check-circle" : "alert-circle"} size={20} color={banner.ok ? colors.success : colors.error} />
              <Text style={[s.bannerText, { color: banner.ok ? colors.success : colors.error }]}>{banner.text}</Text>
            </View>
          ) : null}

          {inv.status === "unpaid" && canMarkPaid ? (
            <Button testID="mark-paid-button" title="Tandai Lunas" icon="cash-check" onPress={() => { setBanner(null); payMutation.mutate(); }} loading={payMutation.isPending} />
          ) : null}

          {inv.status === "unpaid" && role === "pelanggan" ? (
            <Button testID="pay-online-button" title="Bayar Online" icon="credit-card-outline" onPress={() => { setBanner(null); onlinePay.mutate(); }} loading={onlinePay.isPending} />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
