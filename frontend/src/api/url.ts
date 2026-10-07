// Server URL validation + normalization for the ZenRadius multi-server client.

export type NormalizeResult =
  | { ok: true; url: string; host: string }
  | { ok: false; message: string };

// Trim whitespace, add https:// when no protocol is given, drop trailing
// slashes, validate protocol + host. Accepts domains, subdomains and IP:port.
export function normalizeServerUrl(input: string): NormalizeResult {
  let raw = String(input || "").trim();
  if (!raw) return { ok: false, message: "URL server harus diisi." };

  // strip spaces inside
  raw = raw.replace(/\s+/g, "");

  if (!/^https?:\/\//i.test(raw)) {
    raw = "https://" + raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, message: "Format URL server tidak valid." };
  }

  const proto = parsed.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") {
    return { ok: false, message: "Protokol harus http atau https." };
  }
  if (!parsed.hostname) {
    return { ok: false, message: "Alamat host tidak valid." };
  }

  // Rebuild clean origin (+ path if provided, without trailing slash)
  const path = parsed.pathname.replace(/\/+$/, "");
  const clean = `${proto}//${parsed.host}${path}`;
  return { ok: true, url: clean, host: parsed.host };
}
