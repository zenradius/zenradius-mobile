import { Redirect } from "expo-router";
import { View } from "react-native";

import { makeStyles } from "@/src/theme";
import { GradientBackdrop, Logo } from "@/src/components/ui";
import { LoadingView } from "@/src/components/ui";
import { useServer } from "@/src/context/ServerContext";
import { useAuth } from "@/src/context/AuthContext";

const useStyles = makeStyles(() => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28 },
}));

export default function Index() {
  const s = useStyles();
  const { ready, activeServer } = useServer();
  const { status } = useAuth();

  if (!ready || status === "loading") {
    return (
      <GradientBackdrop>
        <View style={s.center} testID="bootstrap-splash">
          <Logo width={220} />
          <LoadingView label="Menghubungkan..." />
        </View>
      </GradientBackdrop>
    );
  }

  if (!activeServer) return <Redirect href="/connect" />;
  if (status === "signedOut") return <Redirect href="/login" />;
  return <Redirect href="/home" />;
}
