# ZenRadius Mobile — Architecture & Build

Official native mobile client for the **ZenRadius Network Management System**.
Built with Expo (React Native). It is a **server-agnostic, multi-server client**:
it connects to any ZenRadius server that implements the Mobile API v1
(`/api/mobile/v1/*`, see upstream repo `routes/mobileApi.js`).

## Architecture
```
Server URL screen → Test Connection (/health) → Login (/auth/login)
→ server returns role + opaque access/refresh tokens
→ tokens stored per-server (SecureStore, isolated by server id)
→ role-based UI (dynamic tabs) → feature screens → Logout
```
- **Network layer:** `src/api/client.ts` (base URL, bearer token, timeout, error mapping, `{success,data}` envelope). `AuthContext` adds single-shot refresh-on-401.
- **State:** TanStack Query for all server data (no hand-rolled fetch/useEffect).
- **Server management:** `ServerContext` — recent servers, switching, per-server session isolation, URL validation/normalization (`src/api/url.ts`).
- **RBAC:** server is the authority (deny-by-default). The client only renders the menus the role is allowed (`src/navigation.ts`). Canonical roles: `admin, customer_service, kolektor, teknisi, reseller, pelanggan`.

## Roles → screens
| Role | Tabs |
|---|---|
| admin / customer_service | Beranda · Pelanggan · Tagihan · Tiket (+Profil via header) |
| pelanggan | Beranda · Tagihan · Tiket · Profil |
| teknisi | Beranda · Tugas · Profil |
| reseller | Beranda · Transaksi · Profil |
| kolektor | Beranda · Penagihan · Profil |

## Security
- Opaque tokens, hashed server-side; stored in SecureStore (Keychain / EncryptedSharedPreferences), never logged.
- Session isolation per server (token key derived from server id).
- Deny-by-default: missing/invalid token → 401; cross-role/IDOR access → 404/403.
- No hard-coded server, credentials, or secrets in the app.

## Reference backend (this environment)
`/app/backend/server.py` is a ZenRadius-Mobile-API-compatible reference server
(FastAPI + MongoDB) mirroring upstream `routes/mobileApi.js`, seeded with
representative data for every role. In production the app points at the ISP's
real ZenRadius server instead — the client code does not change.

## Brand assets
- Logo: upstream `public/img/logo.png` → `assets/logo.png` (splash + headers).
- App icon / adaptive icon / favicon derived from upstream `public/img/icon.png`.
- Navy cyberpunk theme in `src/theme.ts`.

## Android production build
Use the Emergent **Publish** button (top-right) → generate Android build.
EAS / signing are Emergent-managed. The app ID (`android.package`) and launcher
name (`ZenRadius`) are set in `app.json`. Production signing credentials must be
provided by the app owner during the publish/build step.
