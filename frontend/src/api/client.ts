// Low-level HTTP for the ZenRadius Mobile API. One network layer: base URL,
// headers, bearer token, timeout, and uniform error mapping. The ZenRadius
// envelope is { success, data } or { success:false, error:{code,message} }.

export class ApiException extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type RawResult = { status: number; body: any };

const DEFAULT_TIMEOUT = 15000;

export async function rawRequest(
  baseUrl: string,
  path: string,
  opts: {
    method?: string;
    body?: any;
    token?: string | null;
    timeout?: number;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<RawResult> {
  const { method = "GET", body, token, timeout = DEFAULT_TIMEOUT, query } = opts;

  let url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") {
      throw new ApiException("TIMEOUT", "Permintaan ke server melebihi batas waktu. Coba lagi.", 0);
    }
    throw new ApiException(
      "NETWORK_ERROR",
      "Server tidak dapat dijangkau. Periksa alamat server atau koneksi internet Anda.",
      0,
    );
  }
  clearTimeout(timer);

  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (res.ok && parsed && parsed.success) {
    return { status: res.status, body: parsed.data ?? {} };
  }

  // Error envelope
  const code = parsed?.error?.code || "SERVER_ERROR";
  const message =
    parsed?.error?.message ||
    (res.status >= 500
      ? "Terjadi kesalahan pada server. Coba beberapa saat lagi."
      : "Permintaan gagal diproses.");
  throw new ApiException(code, message, res.status);
}
