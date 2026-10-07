import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, GradientBackdrop, Icon, Logo, TextField } from "@/src/components/ui";
import { useServer } from "@/src/context/ServerContext";
import { StoredServer } from "@/src/api/types";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1 },
  hero: { alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  brand: { color: c.onSurface, fontSize: 30, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { color: c.accent, fontSize: 13, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase" },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardTitle: { color: c.onSurface, fontSize: 17, fontWeight: "700" },
  cardHint: { color: c.muted, fontSize: 13, lineHeight: 19 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  recentTitle: { color: c.onSurfaceSecondary, fontSize: 14, fontWeight: "700", marginBottom: spacing.sm },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  serverIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.brandTertiary,
  },
  serverLabel: { color: c.onSurface, fontSize: 15, fontWeight: "600" },
  serverUrl: { color: c.muted, fontSize: 12 },
}));

export default function ConnectScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { servers, testConnection, addAndSelect, selectServer, removeServer } = useServer();

  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const onTest = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    const r = await testConnection(url);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setResult({ ok: true, message: "Koneksi berhasil ke server ZenRadius" });
  };

  const onContinue = async () => {
    setBusy(true);
    const r = await addAndSelect(url);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      setResult(null);
      return;
    }
    router.replace("/");
  };

  const onPickRecent = async (srv: StoredServer) => {
    await selectServer(srv.id);
    router.replace("/");
  };

  return (
    <GradientBackdrop>
      <KeyboardAwareScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <View style={s.hero}>
          <Logo width={200} />
          <Text style={s.subtitle}>Network Management System</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Hubungkan ke Server</Text>
          <Text style={s.cardHint}>
            Masukkan alamat server ZenRadius Anda. Mendukung domain, subdomain, maupun IP dengan port.
          </Text>

          <TextField
            testID="server-url-input"
            label="URL Server"
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setResult(null);
              setError(null);
            }}
            placeholder="https://binusnet.com"
            leftIcon="server-network"
            error={error}
            keyboardType="url"
          />

          {result?.ok ? (
            <View style={[s.banner, { backgroundColor: colors.success + "22" }]} testID="connect-success-banner">
              <Icon name="check-circle" size={20} color={colors.success} />
              <Text style={[s.bannerText, { color: colors.success }]}>{result.message}</Text>
            </View>
          ) : null}

          {result?.ok ? (
            <Button testID="connect-continue-button" title="Lanjutkan" icon="arrow-right" onPress={onContinue} loading={busy} />
          ) : (
            <Button testID="test-connection-button" title="Test Koneksi" icon="access-point-network" onPress={onTest} loading={busy} />
          )}
        </View>

        {servers.length > 0 ? (
          <View>
            <Text style={s.recentTitle}>Server Terakhir</Text>
            <View style={{ gap: spacing.sm }}>
              {servers.map((srv) => (
                <Pressable
                  key={srv.id}
                  testID={`recent-server-${srv.label}`}
                  style={s.serverRow}
                  onPress={() => onPickRecent(srv)}
                >
                  <View style={s.serverIcon}>
                    <Icon name="server" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.serverLabel} numberOfLines={1}>
                      {srv.label}
                    </Text>
                    <Text style={s.serverUrl} numberOfLines={1}>
                      {srv.url}
                    </Text>
                  </View>
                  <Pressable
                    testID={`remove-server-${srv.label}`}
                    hitSlop={10}
                    onPress={() => removeServer(srv.id)}
                  >
                    <Icon name="trash-can-outline" size={20} color={colors.muted} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </GradientBackdrop>
  );
}
