import React from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorView,
  Icon,
  LoadingView,
  SectionTitle,
  StatCard,
} from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { ROLE_LABEL } from "@/src/api/types";
import { compactRupiah, formatDate, rupiah, speedLabel, statusLabel } from "@/src/format";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  grid: { flexDirection: "row", gap: spacing.md },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
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
  rowAmount: { color: c.onSurface, fontSize: 14.5, fontWeight: "700" },
  bigValue: { color: c.onSurface, fontSize: 30, fontWeight: "900" },
  label: { color: c.muted, fontSize: 13 },
  balanceCard: { gap: spacing.xs },
  quickRow: { flexDirection: "row", gap: spacing.md },
  quickBtn: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  quickLabel: { color: c.onSurfaceSecondary, fontSize: 12.5, fontWeight: "600" },
  areaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  areaChipText: { color: c.onSurfaceTertiary, fontSize: 12.5, fontWeight: "600" },
  statusLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={s.quickBtn} onPress={onPress} testID={testID}>
      <Icon name={icon} size={24} color={colors.accent} />
      <Text style={s.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { api, role, serverLabel } = useAuth();

  const me = useQuery({ queryKey: ["me"], queryFn: () => api.get("/api/mobile/v1/me") });
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get("/api/mobile/v1/dashboard") });

  const refreshing = dash.isFetching && !dash.isLoading;
  const onRefresh = () => {
    dash.refetch();
    me.refetch();
  };

  const name = me.data?.name || "Pengguna";
  const roleLabel = role ? ROLE_LABEL[role] : "";

  const headerRight = (
    <Pressable testID="header-profile-button" onPress={() => router.push("/profile")} hitSlop={8}>
      <View style={s.avatar}>
        <Icon name="account" size={22} color={colors.accent} />
      </View>
    </Pressable>
  );

  return (
    <Screen>
      <AppHeader title={`Halo, ${name}`} subtitle={`${roleLabel} · ${serverLabel ?? ""}`} right={headerRight} />
      <ScrollView
        testID="dashboard-scroll"
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {dash.isLoading ? (
          <LoadingView label="Memuat dashboard..." />
        ) : dash.isError ? (
          <ErrorView message={(dash.error as any)?.message || "Gagal memuat"} onRetry={() => dash.refetch()} />
        ) : (
          <DashboardBody data={dash.data} />
        )}
      </ScrollView>
    </Screen>
  );
}

function DashboardBody({ data }: { data: any }) {
  const role = data?.role;
  if (role === "admin" || role === "customer_service") return <StaffDash data={data} />;
  if (role === "teknisi") return <TechDash data={data} />;
  if (role === "reseller") return <ResellerDash data={data} />;
  if (role === "kolektor") return <CollectorDash data={data} />;
  if (role === "pelanggan") return <CustomerDash data={data} />;
  return <EmptyState title="Dashboard tidak tersedia" />;
}

function PaymentRow({ inv }: { inv: any }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable style={s.listRow} onPress={() => router.push(`/invoice/${inv.id}`)} testID={`payment-row-${inv.id}`}>
      <View style={s.avatar}>
        <Icon name="cash-check" size={20} color={colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{inv.customerName || "Pelanggan"}</Text>
        <Text style={s.rowSub}>{inv.periodText} · {formatDate(inv.paidAt)}</Text>
      </View>
      <Text style={s.rowAmount}>{rupiah(inv.amount)}</Text>
    </Pressable>
  );
}

function StaffDash({ data }: { data: any }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const c = data.customers || {};
  const b = data.billing || {};
  const t = data.tickets || {};
  const recent = data.recentPayments || [];
  return (
    <>
      <View style={s.grid}>
        <StatCard icon="account-check" value={c.active ?? 0} label="Pelanggan Aktif" tint={colors.success} testID="stat-active" />
        <StatCard icon="account-alert" value={b.unpaidCount ?? 0} label="Belum Bayar" tint={colors.error} testID="stat-unpaid" />
      </View>
      <View style={s.grid}>
        <StatCard icon="cash-multiple" value={compactRupiah(b.thisMonth)} label="Pendapatan Bln Ini" tint={colors.accent} />
        <StatCard icon="ticket-outline" value={t.open ?? 0} label="Tiket Terbuka" tint={colors.warning} />
      </View>

      <Card>
        <SectionTitle title="Ringkasan Penagihan" />
        <View style={[s.statusLine, { marginBottom: spacing.sm }]}>
          <Text style={s.label}>Total Pendapatan</Text>
          <Text style={s.rowAmount}>{rupiah(b.totalRevenue)}</Text>
        </View>
        <View style={s.statusLine}>
          <Text style={s.label}>Belum Terbayar</Text>
          <Text style={[s.rowAmount, { color: colors.error }]}>{rupiah(b.pendingAmount)}</Text>
        </View>
      </Card>

      <View style={s.quickRow}>
        <QuickAction icon="account-group" label="Pelanggan" onPress={() => router.push("/customers")} testID="quick-customers" />
        <QuickAction icon="receipt-text" label="Tagihan" onPress={() => router.push("/invoices")} testID="quick-invoices" />
        <QuickAction icon="ticket" label="Tiket" onPress={() => router.push("/tickets")} testID="quick-tickets" />
      </View>

      <Card>
        <SectionTitle title="Pembayaran Terbaru" actionLabel="Semua" onAction={() => router.push("/invoices")} />
        {recent.length === 0 ? (
          <EmptyState title="Belum ada pembayaran" />
        ) : (
          recent.map((inv: any) => <PaymentRow key={inv.id} inv={inv} />)
        )}
      </Card>
    </>
  );
}

function TechDash({ data }: { data: any }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const st = data.stats || {};
  const assigned = data.assigned || [];
  return (
    <>
      <View style={s.grid}>
        <StatCard icon="progress-wrench" value={st.inProgress ?? 0} label="Dikerjakan" tint={colors.warning} />
        <StatCard icon="inbox-arrow-down" value={data.openPool ?? 0} label="Pool Terbuka" tint={colors.info} />
      </View>
      <View style={s.grid}>
        <StatCard icon="check-decagram" value={st.resolved ?? 0} label="Selesai" tint={colors.success} />
        <StatCard icon="clipboard-list" value={st.total ?? 0} label="Total Tugas" tint={colors.accent} />
      </View>

      <Button title="Lihat Pool Tiket Terbuka" variant="secondary" icon="inbox-multiple" onPress={() => router.push("/tickets?scope=pool")} />

      <Card>
        <SectionTitle title="Tugas Aktif Saya" actionLabel="Semua" onAction={() => router.push("/tickets")} />
        {assigned.length === 0 ? (
          <EmptyState icon="clipboard-check-outline" title="Tidak ada tugas aktif" subtitle="Ambil tiket dari pool untuk mulai bekerja." />
        ) : (
          assigned.map((t: any) => (
            <Pressable key={t.id} style={s.listRow} onPress={() => router.push(`/ticket/${t.id}`)} testID={`task-row-${t.id}`}>
              <View style={s.avatar}>
                <Icon name="wrench" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{t.subject}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{t.customerName || "Pelanggan"}</Text>
              </View>
              <Badge label={statusLabel(t.status)} status={t.status} />
            </Pressable>
          ))
        )}
      </Card>
    </>
  );
}

function ResellerDash({ data }: { data: any }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const tx = data.recentTransactions || [];
  return (
    <>
      <Card>
        <View style={s.balanceCard}>
          <Text style={s.label}>Saldo Reseller</Text>
          <Text style={s.bigValue} testID="reseller-balance">{rupiah(data.balance)}</Text>
          <Text style={s.rowSub}>Biaya admin per tagihan: {rupiah(data.billingFee)}</Text>
        </View>
      </Card>

      <View style={s.quickRow}>
        <QuickAction icon="cash-register" label="Bayar Tagihan" onPress={() => router.push("/reseller")} testID="quick-pay" />
        <QuickAction icon="swap-horizontal" label="Transaksi" onPress={() => router.push("/reseller")} testID="quick-tx" />
      </View>

      <Card>
        <SectionTitle title="Transaksi Terbaru" actionLabel="Semua" onAction={() => router.push("/reseller")} />
        {tx.length === 0 ? (
          <EmptyState icon="swap-horizontal" title="Belum ada transaksi" />
        ) : (
          tx.map((t: any) => (
            <View key={t.id} style={s.listRow}>
              <View style={s.avatar}>
                <Icon name="cash" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{t.customer_name || t.type}</Text>
                <Text style={s.rowSub}>{t.note || t.type}</Text>
              </View>
              <Text style={s.rowAmount}>{rupiah(t.amount_buy)}</Text>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function CollectorDash({ data }: { data: any }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const recent = data.recentCollections || [];
  return (
    <>
      <View style={s.areaChip}>
        <Icon name="map-marker" size={14} color={colors.accent} />
        <Text style={s.areaChipText}>Area: {data.area || "-"}</Text>
      </View>
      <View style={s.grid}>
        <StatCard icon="account-group" value={data.assignedCustomers ?? 0} label="Pelanggan" tint={colors.accent} />
        <StatCard icon="account-alert" value={data.unpaidCount ?? 0} label="Belum Bayar" tint={colors.error} />
      </View>
      <View style={s.grid}>
        <StatCard icon="cash-check" value={compactRupiah(data.collectedThisMonth)} label="Tertagih Bln Ini" tint={colors.success} />
        <StatCard icon="cash-clock" value={compactRupiah(data.unpaidTotal)} label="Total Tagihan" tint={colors.warning} />
      </View>

      <Button title="Daftar Penagihan" icon="cash-multiple" onPress={() => router.push("/collections")} testID="goto-collections" />

      <Card>
        <SectionTitle title="Penagihan Terbaru" />
        {recent.length === 0 ? (
          <EmptyState icon="cash-multiple" title="Belum ada penagihan" subtitle="Tagihan yang Anda tagih akan muncul di sini." />
        ) : (
          recent.map((inv: any) => <PaymentRow key={inv.id} inv={inv} />)
        )}
      </Card>
    </>
  );
}

function CustomerDash({ data }: { data: any }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const pkg = data.package;
  const unpaid = data.unpaidInvoices || [];
  return (
    <>
      <Card>
        <View style={s.statusLine}>
          <Text style={s.rowTitle}>Status Layanan</Text>
          <Badge label={statusLabel(data.serviceStatus)} status={data.serviceStatus} />
        </View>
        <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />
        <View style={[s.statusLine, { marginBottom: spacing.sm }]}>
          <Text style={s.label}>Paket</Text>
          <Text style={s.rowTitle}>{pkg?.name || "-"}</Text>
        </View>
        {pkg ? (
          <View style={[s.statusLine, { marginBottom: spacing.sm }]}>
            <Text style={s.label}>Kecepatan</Text>
            <Text style={s.rowTitle}>{speedLabel(pkg.speedDown)}</Text>
          </View>
        ) : null}
        <View style={s.statusLine}>
          <Text style={s.label}>Aktif hingga</Text>
          <Text style={s.rowTitle}>{formatDate(data.expiredAt)}</Text>
        </View>
      </Card>

      <Card>
        <SectionTitle title="Tagihan" actionLabel="Riwayat" onAction={() => router.push("/invoices")} />
        <View style={[s.statusLine, { marginBottom: spacing.md }]}>
          <View>
            <Text style={s.label}>Belum dibayar</Text>
            <Text style={[s.bigValue, { fontSize: 24 }]}>{rupiah(data.unpaidTotal)}</Text>
          </View>
          <Badge label={`${data.unpaidCount} tagihan`} tone={data.unpaidCount > 0 ? "error" : "success"} />
        </View>
        {unpaid.length === 0 ? (
          <EmptyState icon="check-circle-outline" title="Tidak ada tagihan" subtitle="Semua tagihan Anda sudah lunas." />
        ) : (
          <>
            {unpaid.map((inv: any) => (
              <Pressable key={inv.id} style={s.listRow} onPress={() => router.push(`/invoice/${inv.id}`)} testID={`unpaid-row-${inv.id}`}>
                <View style={s.avatar}>
                  <Icon name="file-document-alert" size={20} color={colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{inv.periodText}</Text>
                  <Text style={s.rowSub}>Jatuh tempo</Text>
                </View>
                <Text style={[s.rowAmount, { color: colors.error }]}>{rupiah(inv.amount)}</Text>
              </Pressable>
            ))}
            <View style={{ height: spacing.md }} />
            <Button title="Bayar Sekarang" icon="credit-card-outline" onPress={() => router.push(`/invoice/${unpaid[0].id}`)} testID="pay-now-button" />
          </>
        )}
      </Card>

      <View style={s.quickRow}>
        <QuickAction icon="ticket-confirmation" label="Buat Tiket" onPress={() => router.push("/ticket/new")} testID="quick-new-ticket" />
        <QuickAction icon="headset" label="Tiket Saya" onPress={() => router.push("/tickets")} testID="quick-my-tickets" />
      </View>
    </>
  );
}
