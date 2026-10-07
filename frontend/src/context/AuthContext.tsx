import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { storage } from "@/src/utils/storage";
import { ApiException, rawRequest } from "@/src/api/client";
import { Role, Session } from "@/src/api/types";
import { useServer } from "@/src/context/ServerContext";

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  role: Role | null;
  serverUrl: string | null;
  serverLabel: string | null;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  api: {
    get: <T = any>(path: string, query?: Record<string, any>) => Promise<T>;
    post: <T = any>(path: string, body?: any) => Promise<T>;
  };
};

const AuthContext = createContext<AuthContextValue | null>(null);

// SecureStore keys allow [A-Za-z0-9._-] only; derive a short stable key.
function authKey(serverId: string) {
  let h = 5381;
  for (let i = 0; i < serverId.length; i++) h = ((h << 5) + h + serverId.charCodeAt(i)) >>> 0;
  return `zr.auth.${h.toString(36)}`;
}

async function deviceId() {
  let id = await storage.getItem<string>("zr.deviceId", "");
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    await storage.setItem("zr.deviceId", id);
  }
  return id;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { activeServer } = useServer();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const serverUrl = activeServer?.url ?? null;
  const serverId = activeServer?.id ?? null;

  // Load (restore) the per-server session whenever the active server changes.
  useEffect(() => {
    (async () => {
      if (!serverId) {
        setSession(null);
        setStatus("signedOut");
        return;
      }
      setStatus("loading");
      const saved = await storage.secureGet<any>(authKey(serverId), null);
      if (saved && saved.accessToken && saved.refreshToken && saved.role) {
        setSession(saved as Session);
        setStatus("signedIn");
      } else {
        setSession(null);
        setStatus("signedOut");
      }
    })();
  }, [serverId]);

  const persistSession = useCallback(
    async (s: Session | null) => {
      setSession(s);
      sessionRef.current = s;
      if (!serverId) return;
      if (s) await storage.secureSet(authKey(serverId), s as any);
      else await storage.secureRemove(authKey(serverId));
    },
    [serverId],
  );

  const login = useCallback(
    async (identifier: string, password: string) => {
      if (!serverUrl) return { ok: false, message: "Server belum dipilih." };
      try {
        const did = await deviceId();
        const res = await rawRequest(serverUrl, "/api/mobile/v1/auth/login", {
          method: "POST",
          body: { identifier, password, deviceId: did },
          timeout: 15000,
        });
        const s: Session = {
          accessToken: res.body.accessToken,
          refreshToken: res.body.refreshToken,
          role: res.body.role as Role,
          userId: String(res.body.userId),
        };
        await persistSession(s);
        setStatus("signedIn");
        return { ok: true };
      } catch (e: any) {
        return { ok: false, message: e?.message || "Login gagal." };
      }
    },
    [serverUrl, persistSession],
  );

  const logout = useCallback(async () => {
    const s = sessionRef.current;
    if (serverUrl && s) {
      try {
        await rawRequest(serverUrl, "/api/mobile/v1/auth/logout", {
          method: "POST",
          token: s.accessToken,
          timeout: 8000,
        });
      } catch {
        // ignore network errors on logout
      }
    }
    await persistSession(null);
    setStatus("signedOut");
  }, [serverUrl, persistSession]);

  // Authenticated request with single-shot token refresh on 401.
  const authed = useCallback(
    async (method: string, path: string, opts: { body?: any; query?: Record<string, any> } = {}) => {
      if (!serverUrl) throw new ApiException("NO_SERVER", "Server belum dipilih.", 0);
      const s = sessionRef.current;
      if (!s) throw new ApiException("AUTH_REQUIRED", "Sesi berakhir. Silakan login kembali.", 401);

      const doCall = (token: string) =>
        rawRequest(serverUrl, path, { method, body: opts.body, query: opts.query, token });

      try {
        const r = await doCall(s.accessToken);
        return r.body;
      } catch (e: any) {
        if (e instanceof ApiException && e.status === 401) {
          // try refresh once
          try {
            const rf = await rawRequest(serverUrl, "/api/mobile/v1/auth/refresh", {
              method: "POST",
              body: { refreshToken: s.refreshToken },
            });
            const next: Session = { ...s, accessToken: rf.body.accessToken };
            await persistSession(next);
            const retry = await doCall(next.accessToken);
            return retry.body;
          } catch {
            await persistSession(null);
            setStatus("signedOut");
            throw new ApiException("SESSION_EXPIRED", "Sesi berakhir. Silakan login kembali.", 401);
          }
        }
        throw e;
      }
    },
    [serverUrl, persistSession],
  );

  const api = useMemo(
    () => ({
      get: <T,>(path: string, query?: Record<string, any>) => authed("GET", path, { query }) as Promise<T>,
      post: <T,>(path: string, body?: any) => authed("POST", path, { body }) as Promise<T>,
    }),
    [authed],
  );

  const value: AuthContextValue = {
    status,
    session,
    role: session?.role ?? null,
    serverUrl,
    serverLabel: activeServer?.label ?? null,
    login,
    logout,
    api,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
