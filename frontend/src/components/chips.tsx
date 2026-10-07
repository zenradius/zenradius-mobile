import React from "react";
import { Pressable, ScrollView, Text } from "react-native";

import { makeStyles, radius, spacing } from "@/src/theme";

export type ChipOption = { value: string; label: string };

const useStyles = makeStyles((c) => ({
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  text: { color: c.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  textActive: { color: c.onBrandPrimary, fontSize: 13, fontWeight: "700" },
}));

export function Chips({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const s = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={{ height: 56 }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`chip-${o.value || "all"}`}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onChange(o.value)}
          >
            <Text style={active ? s.textActive : s.text}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
