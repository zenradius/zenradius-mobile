// ZenRadius canonical roles — identical to the server (middleware/authz.js).
export type Role =
  | "admin"
  | "customer_service"
  | "kolektor"
  | "teknisi"
  | "reseller"
  | "pelanggan";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  customer_service: "Customer Service",
  kolektor: "Kolektor",
  teknisi: "Teknisi",
  reseller: "Reseller",
  pelanggan: "Pelanggan",
};

export type StoredServer = {
  id: string; // normalized base url (serves as the isolation key)
  url: string; // display url
  label: string; // host
  lastUsedAt: number;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  role: Role;
  userId: string;
};

export type ApiError = { code: string; message: string };
