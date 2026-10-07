# ZenRadius Mobile — PRD

## Original problem statement
Build ZenRadius native mobile app (Expo React Native) as the official mobile client
for the ZenRadius ISP Network Management System. Multi-server client (user enters
server URL, no hard-coded domain), login via existing ZenRadius Mobile API v1,
role detection from server, role-based UI for all roles (Admin, Customer, Reseller,
Teknisi, Kolektor + Customer Service). Real API data, no mock screens. Navy
cyberpunk enterprise design. Secure token storage, session isolation per server.
Android production build. Do not break the existing web/backend.

## Architecture
- Frontend: Expo Router app (`/app/frontend`). TanStack Query, SecureStore, expo-image,
  expo-linear-gradient, @react-native-vector-icons/material-design-icons.
- Network: single API layer (`src/api/client.ts`) + `AuthContext` (refresh-on-401),
  `ServerContext` (multi-server, isolation, URL validation).
- Reference backend: FastAPI + MongoDB (`/app/backend/server.py`) implementing the
  exact ZenRadius Mobile API v1 contract, seeded for all roles.

## User personas / roles
admin, customer_service (Kasir), kolektor (Penagih), teknisi, reseller, pelanggan (Customer).

## Core requirements (static)
- Server URL screen with Test Connection, recent servers, validation/normalization.
- Login via `/api/mobile/v1/auth/login`; server authority for RBAC (deny-by-default).
- Per-server secure token storage + session isolation; refresh + logout.
- Role-based dynamic navigation; only allowed menus/screens.
- All data from real API; no fake production data.
- Navy cyberpunk UI; ZenRadius brand assets; native splash/icon.

## Implemented (2026-10-07)
- Multi-server connect flow (test/add/switch/remove, recent servers, isolation).
- Auth: login (all roles), token refresh on 401, logout, session restore, change password.
- Dashboards per role (admin/CS, teknisi, reseller, kolektor, pelanggan) with real stats.
- Admin/CS: customers list+search+status filter, customer detail, invoices list, invoice detail, mark-paid, tickets manage, create ticket.
- Pelanggan: service status, invoices + history, invoice detail, online payment link, create/view tickets.
- Teknisi: task stats, pool/assigned/history tickets, take ticket, update status + notes.
- Reseller: balance, invoice lookup + pay (balance math), transaction history.
- Kolektor: area collection stats, collections list, mark-paid (own area only).
- Navy cyberpunk theme, MDI icons, splash/app icon from ZenRadius brand assets.
- Reference backend `/api/mobile/v1/*` seeded; RBAC + IDOR protections.
- Tests: backend 47 pass; frontend e2e all 6 roles pass.

## Backlog (prioritized)
- P1: Push notifications (Emergent-managed; needs native build + google-services.json) — build on user request.
- P1: Pagination / infinite scroll for large lists (invoices/customers).
- P2: Offline cache of last dashboard; pull additional reseller/collector reports.
- P2: Refresh-token rotation; login rate-limiting on the reference backend.
- P2: Attach photos to tickets (upload via object storage).

## Next tasks
- Harden/extend per user feedback; wire real production ZenRadius servers during QA.
