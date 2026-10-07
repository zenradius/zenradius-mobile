import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Button, Card, Icon, LoadingView, SectionTitle, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { ROLE_LABEL } from "@/src/api/types";
import { hasProfileTab } from "@/src/navigation";
import { rupiah } from "@/src/format";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.brandTertiary,
    borderWidth: 2,
    borderColor: c.borderStrong,
  },
  name: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  roleText: { color: c.accent, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  infoLabel: { color: c.muted, fontSize: 13.5 },
  infoValue: { color: c.onSurface, fontSize: 14.5, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
}));

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const s = useStyles();
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value || "-"}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { api, role, logout, serverLabel, serverUrl } = useAuth();

  const me = useQuery({ queryKey: ["me"], queryFn: () => api.get("/api/mobile/v1/me") });

  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const changePwd = useMutation({
    mutationFn: () => api.post("/api/mobile/v1/profile/change-password", { currentPassword: cur, newPassword: nw, confirmPassword: cf }),
    onSuccess: async () => {
      setBanner({ ok: true, text: "Kata sandi diubah. Silakan login kembali." });
      setTimeout(async () => {
        await logout();
        router.replace("/");
      }, 1200);
    },
    onError: (e: any) => setBanner({ ok: false, text: e?.message || "Gagal mengubah kata sandi." }),
  });

  const onLogout = async () => {
    await logout();
    router.replace("/");
  };

  const data = me.data;
  const showBack = role ? !hasProfileTab(role) : false;

  return (
    <Screen>
      <AppHeader title="Profil" showBack={showBack} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={me.isFetching && !me.isLoading} onRefresh={() => me.refetch()} tintColor={colors.brand} />}
      >
        {me.isLoading ? (
          <LoadingView />
        ) : (
          <>
            <View style={s.header}>
              <View style={s.avatar}>
                <Icon name="account" size={40} color={colors.accent} />
              </View>
              <Text style={s.name}>{data?.name || "Pengguna"}</Text>
              <Text style={s.roleText}>{role ? ROLE_LABEL[role] : ""}</Text>
            </View>

            <Card>
              <SectionTitle title="Informasi Akun" />
              <InfoRow label="Nama" value={data?.name} />
              {data?.username ? <InfoRow label="Username" value={data.username} /> : null}
              {data?.phone ? <InfoRow label="Telepon" value={data.phone} /> : null}
              {data?.email ? <InfoRow label="Email" value={data.email} /> : null}
              {data?.area ? <InfoRow label="Area" value={data.area} /> : null}
              {data?.packageName ? <InfoRow label="Paket" value={data.packageName} /> : null}
              {typeof data?.balance === "number" ? <InfoRow label="Saldo" value={rupiah(data.balance)} /> : null}
            </Card>

            <Card>
              <SectionTitle title="Server" />
              <InfoRow label="Server" value={serverLabel} />
              <InfoRow label="URL" value={serverUrl} />
            </Card>

            {data?.canChangePassword ? (
              <Card>
                <SectionTitle title="Ubah Kata Sandi" />
                <View style={{ gap: spacing.md }}>
                  <TextField testID="pwd-current" label="Kata Sandi Saat Ini" value={cur} onChangeText={setCur} secure placeholder="••••••••" />
                  <TextField testID="pwd-new" label="Kata Sandi Baru (min 8)" value={nw} onChangeText={setNw} secure placeholder="••••••••" />
                  <TextField testID="pwd-confirm" label="Konfirmasi Kata Sandi" value={cf} onChangeText={setCf} secure placeholder="••••••••" />
                  {banner ? (
                    <View style={[s.banner, { backgroundColor: (banner.ok ? colors.success : colors.error) + "22" }]} testID="pwd-banner">
                      <Icon name={banner.ok ? "check-circle" : "alert-circle"} size={20} color={banner.ok ? colors.success : colors.error} />
                      <Text style={[s.bannerText, { color: banner.ok ? colors.success : colors.error }]}>{banner.text}</Text>
                    </View>
                  ) : null}
                  <Button testID="change-password-button" title="Simpan Kata Sandi" icon="lock-reset" variant="secondary" onPress={() => { setBanner(null); changePwd.mutate(); }} loading={changePwd.isPending} />
                </View>
              </Card>
            ) : null}

            <Button testID="logout-button" title="Keluar" icon="logout" variant="danger" onPress={onLogout} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
