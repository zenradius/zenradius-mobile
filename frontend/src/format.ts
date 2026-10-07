export function rupiah(n: number | null | undefined): string {
  const v = Number(n || 0);
  return "Rp " + v.toLocaleString("id-ID");
}

export function compactRupiah(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (v >= 1_000_000) return "Rp " + (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + "jt";
  if (v >= 1_000) return "Rp " + (v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 0) + "rb";
  return "Rp " + v.toLocaleString("id-ID");
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function speedLabel(kbps?: number | null): string {
  const v = Number(kbps || 0);
  if (!v) return "-";
  if (v >= 1000) return `${Math.round(v / 1000)} Mbps`;
  return `${v} Kbps`;
}

export function statusLabel(status?: string | null): string {
  switch (status) {
    case "active":
      return "Aktif";
    case "suspended":
      return "Isolir";
    case "inactive":
      return "Nonaktif";
    case "paid":
      return "Lunas";
    case "unpaid":
      return "Belum Bayar";
    case "open":
      return "Baru";
    case "in_progress":
      return "Dikerjakan";
    case "resolved":
      return "Selesai";
    default:
      return status || "-";
  }
}
