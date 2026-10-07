import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Badge, Button, Card, ErrorView, Icon, LoadingView, SectionTitle, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { formatDateTime, statusLabel } from "@/src/format";
import { STAFF_ROLES } from "@/src/navigation";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  subject: { color: c.onSurface, fontSize: 18, fontWeight: "800" },
  message: { color: c.onSurfaceSecondary, fontSize: 14.5, lineHeight: 21 },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  label: { color: c.muted, fontSize: 13.5 },
  value: { color: c.onSurface, fontSize: 14.5, fontWeight: "600", maxWidth: "62%", textAlign: "right" },
  notes: { color: c.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  statusBtns: { flexDirection: "row", gap: spacing.sm },
}));

export default function TicketDetailScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, role } = useAuth();
  const qc = useQueryClient();
  const isStaff = role ? STAFF_ROLES.includes(role) : false;
  const isTech = role === "teknisi";

  const [notes, setNotes] = useState("");
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const query = useQuery({ queryKey: ["ticket", id], queryFn: () => api.get(`/api/mobile/v1/tickets/${id}`) });
  const t = query.data?.ticket;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ticket", id] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const takeMut = useMutation({
    mutationFn: () => api.post(`/api/mobile/v1/tickets/${id}/take`),
    onSuccess: () => { setBanner({ ok: true, text: "Tiket diambil. Status: Dikerjakan." }); invalidate(); },
    onError: (e: any) => setBanner({ ok: false, text: e?.message || "Gagal mengambil tiket." }),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => api.post(`/api/mobile/v1/tickets/${id}/status`, { status, notes: notes || undefined }),
    onSuccess: () => { setBanner({ ok: true, text: "Status tiket diperbarui." }); invalidate(); },
    onError: (e: any) => setBanner({ ok: false, text: e?.message || "Gagal memperbarui status." }),
  });

  const showTake = isTech && t?.status === "open" && !t?.technicianId;
  const showTechUpdate = isTech && String(t?.technicianId || "") && t?.status !== "resolved";
  const Wrapper: any = isTech || isStaff ? KeyboardAwareScrollView : ScrollView;

  return (
    <Screen>
      <AppHeader title="Detail Tiket" showBack />
      {query.isLoading ? (
        <LoadingView />
      ) : query.isError || !t ? (
        <ErrorView message={(query.error as any)?.message || "Tiket tidak ditemukan"} onRetry={() => query.refetch()} />
      ) : (
        <Wrapper contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false} bottomOffset={20} keyboardShouldPersistTaps="handled">
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
              <Text style={s.subject} numberOfLines={2}>{t.subject}</Text>
              <Badge label={statusLabel(t.status)} status={t.status} />
            </View>
            <Text style={s.message}>{t.message}</Text>
          </Card>

          <Card>
            <SectionTitle title="Informasi" />
            <View style={s.infoRow}><Text style={s.label}>Pelanggan</Text><Text style={s.value}>{t.customerName || "-"}</Text></View>
            {t.customerPhone ? <View style={s.infoRow}><Text style={s.label}>Telepon</Text><Text style={s.value}>{t.customerPhone}</Text></View> : null}
            {t.customerAddress ? <View style={s.infoRow}><Text style={s.label}>Alamat</Text><Text style={s.value}>{t.customerAddress}</Text></View> : null}
            <View style={s.infoRow}><Text style={s.label}>Teknisi</Text><Text style={s.value}>{t.technicianName || "Belum ditugaskan"}</Text></View>
            <View style={s.infoRow}><Text style={s.label}>Dibuat</Text><Text style={s.value}>{formatDateTime(t.createdAt)}</Text></View>
            {t.technicianNotes ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={s.label}>Catatan Teknisi</Text>
                <Text style={s.notes}>{t.technicianNotes}</Text>
              </View>
            ) : null}
          </Card>

          {banner ? (
            <View style={[s.banner, { backgroundColor: (banner.ok ? colors.success : colors.error) + "22" }]} testID="ticket-banner">
              <Icon name={banner.ok ? "check-circle" : "alert-circle"} size={20} color={banner.ok ? colors.success : colors.error} />
              <Text style={[s.bannerText, { color: banner.ok ? colors.success : colors.error }]}>{banner.text}</Text>
            </View>
          ) : null}

          {showTake ? (
            <Button testID="take-ticket-button" title="Ambil Tiket" icon="hand-back-right" onPress={() => { setBanner(null); takeMut.mutate(); }} loading={takeMut.isPending} />
          ) : null}

          {showTechUpdate ? (
            <Card>
              <SectionTitle title="Perbarui Status" />
              <TextField testID="ticket-notes-input" label="Catatan Teknisi (opsional)" value={notes} onChangeText={setNotes} placeholder="Tulis catatan pengerjaan..." />
              <View style={{ height: spacing.md }} />
              <View style={s.statusBtns}>
                <Button testID="status-inprogress" title="Dikerjakan" variant="secondary" onPress={() => { setBanner(null); statusMut.mutate("in_progress"); }} loading={statusMut.isPending} style={{ flex: 1 }} />
                <Button testID="status-resolved" title="Selesai" icon="check" onPress={() => { setBanner(null); statusMut.mutate("resolved"); }} loading={statusMut.isPending} style={{ flex: 1 }} />
              </View>
            </Card>
          ) : null}

          {isStaff ? (
            <Card>
              <SectionTitle title="Kelola Tiket" />
              <View style={s.statusBtns}>
                <Button testID="staff-inprogress" title="Proses" variant="secondary" onPress={() => { setBanner(null); statusMut.mutate("in_progress"); }} loading={statusMut.isPending} style={{ flex: 1 }} />
                <Button testID="staff-resolved" title="Selesai" icon="check" onPress={() => { setBanner(null); statusMut.mutate("resolved"); }} loading={statusMut.isPending} style={{ flex: 1 }} />
              </View>
            </Card>
          ) : null}
        </Wrapper>
      )}
    </Screen>
  );
}
