import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { rawRequest } from "@/src/api/client";
import { normalizeServerUrl } from "@/src/api/url";
import { StoredServer } from "@/src/api/types";

const SERVERS_KEY = "zr.servers";
const ACTIVE_KEY = "zr.activeServer";

type ServerContextValue = {
  ready: boolean;
  servers: StoredServer[];
  activeServer: StoredServer | null;
  testConnection: (url: string) => Promise<{ ok: boolean; message: string; normalizedUrl?: string }>;
  selectServer: (id: string) => Promise<void>;
  addAndSelect: (url: string) => Promise<{ ok: boolean; message: string }>;
  removeServer: (id: string) => Promise<void>;
  clearActive: () => Promise<void>;
};

const ServerContext = createContext<ServerContextValue | null>(null);

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [servers, setServers] = useState<StoredServer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const list = (await storage.getItem<any>(SERVERS_KEY, [])) as StoredServer[] | null;
      const active = await storage.getItem<string>(ACTIVE_KEY, "");
      setServers(Array.isArray(list) ? list : []);
      setActiveId(active || null);
      setReady(true);
    })();
  }, []);

  const persist = useCallback(async (list: StoredServer[]) => {
    setServers(list);
    await storage.setItem(SERVERS_KEY, list as any);
  }, []);

  const testConnection = useCallback(async (url: string) => {
    const norm = normalizeServerUrl(url);
    if (!norm.ok) return { ok: false, message: norm.message };
    try {
      const res = await rawRequest(norm.url, "/api/mobile/v1/health", { timeout: 12000 });
      if (res.body?.status === "ok") {
        return { ok: true, message: "Koneksi berhasil", normalizedUrl: norm.url };
      }
      return { ok: false, message: "Server merespons tetapi bukan server ZenRadius yang valid." };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Server tidak dapat dijangkau." };
    }
  }, []);

  const addAndSelect = useCallback(
    async (url: string) => {
      const test = await testConnection(url);
      if (!test.ok || !test.normalizedUrl) return { ok: false, message: test.message };
      const normalizedUrl = test.normalizedUrl;
      const host = normalizeServerUrl(normalizedUrl).ok
        ? (normalizeServerUrl(normalizedUrl) as any).host
        : normalizedUrl;
      const entry: StoredServer = {
        id: normalizedUrl,
        url: normalizedUrl,
        label: host,
        lastUsedAt: Date.now(),
      };
      const existing = servers.filter((s) => s.id !== entry.id);
      const list = [entry, ...existing].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, 8);
      await persist(list);
      setActiveId(entry.id);
      await storage.setItem(ACTIVE_KEY, entry.id);
      return { ok: true, message: "Koneksi berhasil" };
    },
    [servers, persist, testConnection],
  );

  const selectServer = useCallback(
    async (id: string) => {
      const list = servers.map((s) => (s.id === id ? { ...s, lastUsedAt: Date.now() } : s));
      await persist(list);
      setActiveId(id);
      await storage.setItem(ACTIVE_KEY, id);
    },
    [servers, persist],
  );

  const removeServer = useCallback(
    async (id: string) => {
      const list = servers.filter((s) => s.id !== id);
      await persist(list);
      if (activeId === id) {
        setActiveId(null);
        await storage.removeItem(ACTIVE_KEY);
      }
    },
    [servers, activeId, persist],
  );

  const clearActive = useCallback(async () => {
    setActiveId(null);
    await storage.removeItem(ACTIVE_KEY);
  }, []);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeId) || null,
    [servers, activeId],
  );

  const value: ServerContextValue = {
    ready,
    servers,
    activeServer,
    testConnection,
    selectServer,
    addAndSelect,
    removeServer,
    clearActive,
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer must be used within ServerProvider");
  return ctx;
}
