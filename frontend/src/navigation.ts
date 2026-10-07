import { Platform } from "react-native";

import { Role } from "@/src/api/types";

// Native tabs only on iOS 26+. Everything else uses the classic JS <Tabs>.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export type TabRoute = "home" | "customers" | "invoices" | "collections" | "tickets" | "reseller" | "profile";

export type TabItem = { name: TabRoute; label: string; icon: string; sf: string };

export const ALL_ROUTES: TabRoute[] = [
  "home",
  "customers",
  "invoices",
  "collections",
  "tickets",
  "reseller",
  "profile",
];

const HOME: TabItem = { name: "home", label: "Beranda", icon: "view-dashboard-outline", sf: "square.grid.2x2" };
const CUSTOMERS: TabItem = { name: "customers", label: "Pelanggan", icon: "account-group-outline", sf: "person.3" };
const INVOICES: TabItem = { name: "invoices", label: "Tagihan", icon: "receipt-text-outline", sf: "doc.text" };
const COLLECTIONS: TabItem = { name: "collections", label: "Penagihan", icon: "cash-multiple", sf: "banknote" };
const TICKETS: TabItem = { name: "tickets", label: "Tiket", icon: "ticket-confirmation-outline", sf: "ticket" };
const TASKS: TabItem = { name: "tickets", label: "Tugas", icon: "clipboard-list-outline", sf: "list.clipboard" };
const RESELLER: TabItem = { name: "reseller", label: "Transaksi", icon: "swap-horizontal", sf: "arrow.left.arrow.right" };
const PROFILE: TabItem = { name: "profile", label: "Profil", icon: "account-circle-outline", sf: "person.crop.circle" };

export const ROLE_TABS: Record<Role, TabItem[]> = {
  admin: [HOME, CUSTOMERS, INVOICES, TICKETS],
  customer_service: [HOME, CUSTOMERS, INVOICES, TICKETS],
  pelanggan: [HOME, INVOICES, TICKETS, PROFILE],
  teknisi: [HOME, TASKS, PROFILE],
  reseller: [HOME, RESELLER, PROFILE],
  kolektor: [HOME, COLLECTIONS, PROFILE],
};

export const STAFF_ROLES: Role[] = ["admin", "customer_service"];

// Does this role have Profile as a tab? (Staff reach profile via the header.)
export function hasProfileTab(role: Role) {
  return ROLE_TABS[role].some((t) => t.name === "profile");
}
