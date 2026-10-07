import React, { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppHeader, Screen } from "@/src/components/layout";
import { Button, Card, Icon, TextField } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { STAFF_ROLES } from "@/src/navigation";

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  hint: { color: c.muted, fontSize: 13, lineHeight: 19 },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  input: {
    minHeight: 120,
    color: c.onSurface,
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    fontSize: 16,
    textAlignVertical: "top",
  },
  label: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: spacing.sm },
}));

export default function NewTicketScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { api, role } = useAuth();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const isStaff = role ? STAFF_ROLES.includes(role) : false;

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [customerId, setCustomerId] = useState(params.customerId || "");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () => {
      const body: any = { subject: subject.trim(), message: message.trim() };
      if (isStaff && customerId.trim()) body.customerId = Number(customerId.trim());
      return api.post("/api/mobile/v1/tickets", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      router.back();
    },
    onError: (e: any) => setError(e?.message || "Gagal membuat tiket."),
  });

  const onSubmit = () => {
    setError(null);
    if (subject.trim().length < 3) return setError("Judul tiket minimal 3 karakter.");
    if (message.trim().length < 5) return setError("Deskripsi tiket minimal 5 karakter.");
    createMut.mutate();
  };

  return (
    <Screen>
      <AppHeader title="Buat Tiket" showBack />
      <KeyboardAwareScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <Card>
          <Text style={s.hint}>
            {isStaff
              ? "Buat tiket gangguan untuk pelanggan. Kosongkan ID pelanggan untuk tiket umum."
              : "Laporkan gangguan atau permintaan layanan Anda. Tim teknisi akan menindaklanjuti."}
          </Text>
          <View style={{ height: spacing.md }} />
          {isStaff ? (
            <>
              <TextField testID="ticket-customer-id" label="ID Pelanggan (opsional)" value={customerId} onChangeText={setCustomerId} placeholder="cth: 101" keyboardType="number-pad" />
              <View style={{ height: spacing.md }} />
            </>
          ) : null}
          <TextField testID="ticket-subject-input" label="Judul" value={subject} onChangeText={setSubject} placeholder="cth: Internet lambat" autoCapitalize="sentences" />
          <View style={{ height: spacing.md }} />
          <Text style={s.label}>Deskripsi</Text>
          <TextField testID="ticket-message-input" value={message} onChangeText={setMessage} placeholder="Jelaskan detail masalah Anda..." autoCapitalize="sentences" />

          {error ? (
            <View style={[s.banner, { backgroundColor: colors.error + "22", marginTop: spacing.md }]} testID="new-ticket-error">
              <Icon name="alert-circle-outline" size={20} color={colors.error} />
              <Text style={[s.bannerText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}
        </Card>

        <Button testID="submit-ticket-button" title="Kirim Tiket" icon="send" onPress={onSubmit} loading={createMut.isPending} />
      </KeyboardAwareScrollView>
    </Screen>
  );
}
