import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, GradientBackdrop, Icon, Logo, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useServer } from "@/src/context/ServerContext";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1 },
  hero: { alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  subtitle: { color: c.accent, fontSize: 13, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase" },
  serverChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "center",
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  serverChipText: { color: c.onSurfaceTertiary, fontSize: 12.5, fontWeight: "600" },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardTitle: { color: c.onSurface, fontSize: 18, fontWeight: "800" },
  cardHint: { color: c.muted, fontSize: 13 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  change: { color: c.brand, fontSize: 13, fontWeight: "700", textAlign: "center" },
}));

export default function LoginScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, serverLabel } = useAuth();
  const { clearActive } = useServer();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Isi username/telepon dan kata sandi.");
      return;
    }
    setBusy(true);
    const r = await login(identifier.trim(), password);
    setBusy(false);
    if (!r.ok) {
      setError(r.message || "Login gagal.");
      return;
    }
    router.replace("/home");
  };

  const onChangeServer = async () => {
    router.replace("/connect");
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
          <Logo width={190} />
          <Text style={s.subtitle}>Network Management System</Text>
          <View style={s.serverChip}>
            <Icon name="server-network" size={14} color={colors.accent} />
            <Text style={s.serverChipText} numberOfLines={1}>
              {serverLabel || "Server"}
            </Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Masuk</Text>
          <Text style={s.cardHint}>Gunakan akun ZenRadius Anda.</Text>

          <TextField
            testID="login-identifier-input"
            label="Username / Telepon / Email"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="cth: zenradius"
            leftIcon="account-outline"
          />
          <TextField
            testID="login-password-input"
            label="Kata Sandi"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            leftIcon="lock-outline"
            secure
          />

          {error ? (
            <View style={[s.errorBanner, { backgroundColor: colors.error + "22" }]} testID="login-error-banner">
              <Icon name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={[s.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <Button testID="login-submit-button" title="Masuk" icon="login" onPress={onLogin} loading={busy} />
        </View>

        <Pressable testID="change-server-button" onPress={onChangeServer} hitSlop={8}>
          <Text style={s.change}>Ganti Server</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </GradientBackdrop>
  );
}
