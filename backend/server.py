"""
ZenRadius Mobile API v1 — reference server.

This FastAPI service implements the exact ZenRadius Mobile API contract that the
official ZenRadius web platform exposes at `/api/mobile/v1/*` (see upstream
repo routes/mobileApi.js). The ZenRadius mobile app is a server-agnostic client:
it connects to ANY ZenRadius server that implements this protocol. This process
acts as a fully functional reference/demo ZenRadius server backed by MongoDB so
the app can be exercised end-to-end with real auth, real RBAC and real data.

Canonical roles (identical to upstream middleware/authz.js):
  admin | customer_service | kolektor | teknisi | reseller | pelanggan
Envelope:
  success -> { "success": true, "data": {...} }
  error   -> { "success": false, "error": { "code": "...", "message": "..." } }
"""

import os
import hashlib
import secrets
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter, Request, Depends, Header
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("zenradius-mobile")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="ZenRadius Mobile API", version="v1")
api = APIRouter(prefix="/api")
mobile = APIRouter(prefix="/api/mobile/v1")

ACCESS_TTL = 15 * 60
REFRESH_TTL = 30 * 24 * 60 * 60
STAFF_ROLES = ["admin", "customer_service"]
PAY_ROLES = ["admin", "customer_service", "kolektor"]
MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"]


# ----------------------------------------------------------------------------- helpers
def ok(data=None):
    return JSONResponse(status_code=200, content={"success": True, "data": data or {}})


def ok201(data=None):
    return JSONResponse(status_code=201, content={"success": True, "data": data or {}})


def err(status, code, message):
    return JSONResponse(status_code=status, content={"success": False, "error": {"code": code, "message": message}})


def now_epoch():
    return int(datetime.now(timezone.utc).timestamp())


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_token(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


def gen_token() -> str:
    return secrets.token_urlsafe(64)[:88]


def period_text(inv):
    if not inv:
        return "-"
    m = int(inv.get("period_month") or 0)
    label = MONTHS_ID[m - 1] if 1 <= m <= 12 else str(m)
    return f"{label} {inv.get('period_year') or ''}".strip()


def project_invoice(inv):
    if not inv:
        return None
    return {
        "id": inv["id"],
        "customerId": inv.get("customer_id"),
        "customerName": inv.get("customer_name"),
        "periodMonth": inv.get("period_month"),
        "periodYear": inv.get("period_year"),
        "periodText": period_text(inv),
        "amount": int(inv.get("amount") or 0),
        "status": inv.get("status"),
        "paidAt": inv.get("paid_at"),
        "paidByName": inv.get("paid_by_name"),
        "packageName": inv.get("package_name"),
        "createdAt": inv.get("created_at"),
    }


def project_ticket(t):
    if not t:
        return None
    return {
        "id": t["id"],
        "customerId": t.get("customer_id"),
        "customerName": t.get("customer_name"),
        "customerPhone": t.get("customer_phone"),
        "customerAddress": t.get("customer_address"),
        "subject": t.get("subject"),
        "message": t.get("message"),
        "status": t.get("status"),
        "technicianId": t.get("technician_id"),
        "technicianName": t.get("technician_name"),
        "technicianNotes": t.get("technician_notes"),
        "createdAt": t.get("created_at"),
        "updatedAt": t.get("updated_at"),
    }


def project_customer(c):
    if not c:
        return None
    return {
        "id": c["id"],
        "name": c.get("name"),
        "phone": c.get("phone"),
        "email": c.get("email"),
        "address": c.get("address"),
        "area": c.get("area"),
        "status": c.get("status"),
        "packageId": c.get("package_id"),
        "packageName": c.get("package_name"),
        "pppoeUsername": c.get("pppoe_username"),
        "connectionType": c.get("connection_type"),
        "installDate": c.get("install_date"),
        "expiredAt": c.get("expired_at"),
        "createdAt": c.get("created_at"),
    }


async def attach_names(invoices):
    """Attach customer_name + package_name onto invoice dicts."""
    out = []
    for inv in invoices:
        c = await db.customers.find_one({"id": inv["customer_id"]})
        inv["customer_name"] = c.get("name") if c else None
        if c and c.get("package_id"):
            pkg = await db.packages.find_one({"id": c["package_id"]})
            inv["package_name"] = pkg.get("name") if pkg else None
        out.append(inv)
    return out


# ----------------------------------------------------------------------------- auth
async def create_session(user_id, role, device_id=None):
    access = gen_token()
    refresh = gen_token()
    n = now_epoch()
    await db.mobile_sessions.insert_one({
        "user_id": str(user_id),
        "role": role,
        "device_id": device_id,
        "access_hash": hash_token(access),
        "refresh_hash": hash_token(refresh),
        "access_expires_at": n + ACCESS_TTL,
        "refresh_expires_at": n + REFRESH_TTL,
        "revoked": False,
        "created_at": now_iso(),
    })
    return {"accessToken": access, "refreshToken": refresh, "expiresIn": ACCESS_TTL}


async def get_mobile_user(authorization: str = Header(default="")):
    m = authorization or ""
    if not m.startswith("Bearer "):
        return None
    token = m[7:].strip()
    if not token:
        return None
    s = await db.mobile_sessions.find_one({
        "access_hash": hash_token(token),
        "revoked": False,
        "access_expires_at": {"$gt": now_epoch()},
    })
    if not s:
        return None
    return {"userId": s["user_id"], "role": s["role"], "deviceId": s.get("device_id"), "token": token}


# ----------------------------------------------------------------------------- health
@mobile.get("/health")
async def health():
    return ok({"status": "ok", "apiVersion": "v1", "timestamp": now_iso(), "server": "ZenRadius"})


@api.get("/")
async def root():
    return {"service": "ZenRadius Mobile API", "version": "v1"}


# ----------------------------------------------------------------------------- login
@mobile.post("/auth/login")
async def login(req: Request):
    body = await req.json()
    identifier = (body.get("identifier") or "").strip()
    password = body.get("password") or ""
    device_id = body.get("deviceId")
    if not identifier:
        return err(422, "VALIDATION_ERROR", "Identifier harus diisi (phone, email, atau username).")
    if not password:
        return err(422, "VALIDATION_ERROR", "Password harus diisi.")

    # 1) master / local admin
    master_user = os.environ.get("MASTER_ADMIN_USERNAME", "zenradius")
    master_pass = os.environ.get("MASTER_ADMIN_PASSWORD", "zenradius123")
    if identifier == master_user and password == master_pass:
        s = await create_session("admin-master", "admin", device_id)
        return ok({**s, "role": "admin", "userId": "admin-master"})

    # 2) cashiers -> customer_service
    row = await db.cashiers.find_one({"username": identifier, "is_active": 1})
    if row and pwd.verify(password, row["password"]):
        s = await create_session(row["id"], "customer_service", device_id)
        return ok({**s, "role": "customer_service", "userId": str(row["id"])})

    # 3) technicians -> teknisi
    row = await db.technicians.find_one({"username": identifier, "is_active": 1})
    if row and pwd.verify(password, row["password"]):
        s = await create_session(row["id"], "teknisi", device_id)
        return ok({**s, "role": "teknisi", "userId": str(row["id"])})

    # 4) collectors -> kolektor
    row = await db.collectors.find_one({"username": identifier, "is_active": 1})
    if row and pwd.verify(password, row["password"]):
        s = await create_session(row["id"], "kolektor", device_id)
        return ok({**s, "role": "kolektor", "userId": str(row["id"])})

    # 5) agents -> reseller
    row = await db.agents.find_one({"username": identifier, "is_active": 1})
    if row and pwd.verify(password, row["password"]):
        s = await create_session(row["id"], "reseller", device_id)
        return ok({**s, "role": "reseller", "userId": str(row["id"])})

    # 6) customers -> pelanggan (identifier = phone / pppoe_username / email)
    cust = await db.customers.find_one({
        "$or": [{"phone": identifier}, {"pppoe_username": identifier}, {"email": identifier}],
    })
    if cust and cust.get("status") == "active" and cust.get("portal_password"):
        if pwd.verify(password, cust["portal_password"]):
            s = await create_session(cust["id"], "pelanggan", device_id)
            return ok({**s, "role": "pelanggan", "userId": str(cust["id"])})

    logger.warning(f"[mobile-auth] login failed identifier={identifier}")
    return err(401, "INVALID_CREDENTIALS", "Identifier atau password salah.")


@mobile.post("/auth/refresh")
async def refresh(req: Request):
    body = await req.json()
    rt = (body.get("refreshToken") or "").strip()
    if not rt:
        return err(422, "VALIDATION_ERROR", "Refresh token harus diisi.")
    s = await db.mobile_sessions.find_one({
        "refresh_hash": hash_token(rt), "revoked": False,
        "refresh_expires_at": {"$gt": now_epoch()},
    })
    if not s:
        return err(401, "INVALID_TOKEN", "Refresh token tidak valid atau sudah expired.")
    new_access = gen_token()
    await db.mobile_sessions.update_one({"_id": s["_id"]}, {"$set": {
        "access_hash": hash_token(new_access), "access_expires_at": now_epoch() + ACCESS_TTL,
    }})
    return ok({"accessToken": new_access, "expiresIn": ACCESS_TTL})


@mobile.post("/auth/logout")
async def logout(user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    await db.mobile_sessions.update_one({"access_hash": hash_token(user["token"])}, {"$set": {"revoked": True}})
    return ok({})


# ----------------------------------------------------------------------------- me
@mobile.get("/me")
async def me(user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    uid, role = user["userId"], user["role"]

    if role == "admin":
        return ok({"userId": uid, "role": role, "username": os.environ.get("MASTER_ADMIN_USERNAME", "zenradius"),
                   "name": "Administrator", "canChangePassword": False})

    if role == "pelanggan":
        c = await db.customers.find_one({"id": int(uid)})
        if not c:
            return err(404, "NOT_FOUND", "User tidak ditemukan.")
        pkg = await db.packages.find_one({"id": c.get("package_id")}) if c.get("package_id") else None
        return ok({"userId": str(c["id"]), "role": role, "phone": c.get("phone"), "email": c.get("email"),
                   "name": c.get("name"), "address": c.get("address"), "status": c.get("status"),
                   "pppoeUsername": c.get("pppoe_username"), "packageName": pkg.get("name") if pkg else None,
                   "canChangePassword": True})

    if role == "reseller":
        a = await db.agents.find_one({"id": int(uid)})
        if not a:
            return err(404, "NOT_FOUND", "User tidak ditemukan.")
        return ok({"userId": str(a["id"]), "role": role, "username": a.get("username"), "name": a.get("name"),
                   "phone": a.get("phone"), "balance": int(a.get("balance") or 0),
                   "billingFee": int(a.get("billing_fee") or 0), "canChangePassword": True})

    table = {"teknisi": "technicians", "customer_service": "cashiers", "kolektor": "collectors"}[role]
    u = await db[table].find_one({"id": int(uid)})
    if not u:
        return err(404, "NOT_FOUND", "User tidak ditemukan.")
    return ok({"userId": str(u["id"]), "role": role, "username": u.get("username"), "name": u.get("name"),
               "phone": u.get("phone"), "area": u.get("area"), "canChangePassword": True})


# ----------------------------------------------------------------------------- dashboard
async def customer_stats():
    total = await db.customers.count_documents({})
    active = await db.customers.count_documents({"status": "active"})
    suspended = await db.customers.count_documents({"status": "suspended"})
    inactive = await db.customers.count_documents({"status": "inactive"})
    return {"total": total, "active": active, "suspended": suspended, "inactive": inactive}


async def billing_stats():
    now = datetime.now(timezone.utc)
    paid = await db.invoices.find({"status": "paid"}).to_list(5000)
    unpaid = await db.invoices.find({"status": "unpaid"}).to_list(5000)
    this_month = sum(int(i["amount"]) for i in paid if i.get("period_month") == now.month and i.get("period_year") == now.year)
    return {
        "totalRevenue": sum(int(i["amount"]) for i in paid),
        "thisMonth": this_month,
        "pendingAmount": sum(int(i["amount"]) for i in unpaid),
        "unpaidCount": len(unpaid),
        "unpaidCustomers": len({i["customer_id"] for i in unpaid}),
    }


async def ticket_stats():
    o = await db.tickets.count_documents({"status": "open"})
    p = await db.tickets.count_documents({"status": "in_progress"})
    r = await db.tickets.count_documents({"status": "resolved"})
    return {"open": o, "inProgress": p, "resolved": r, "total": o + p + r}


@mobile.get("/dashboard")
async def dashboard(user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    uid, role = user["userId"], user["role"]

    if role in STAFF_ROLES:
        recent = await db.invoices.find({"status": "paid"}).sort("paid_at", -1).limit(5).to_list(5)
        recent = await attach_names(recent)
        return ok({"role": role, "customers": await customer_stats(), "billing": await billing_stats(),
                   "tickets": await ticket_stats(), "recentPayments": [project_invoice(i) for i in recent]})

    if role == "teknisi":
        total = await db.tickets.count_documents({"technician_id": int(uid)})
        inprog = await db.tickets.count_documents({"technician_id": int(uid), "status": "in_progress"})
        resolved = await db.tickets.count_documents({"technician_id": int(uid), "status": "resolved"})
        pool = await db.tickets.count_documents({"status": "open", "technician_id": None})
        assigned = await db.tickets.find({"technician_id": int(uid), "status": {"$ne": "resolved"}}).sort("id", -1).limit(5).to_list(5)
        assigned = await attach_names(assigned)
        return ok({"role": role, "stats": {"total": total, "open": pool, "inProgress": inprog, "resolved": resolved},
                   "openPool": pool, "assigned": [project_ticket(t) for t in assigned]})

    if role == "reseller":
        a = await db.agents.find_one({"id": int(uid)})
        if not a:
            return err(404, "NOT_FOUND", "Reseller tidak ditemukan.")
        tx = await db.agent_transactions.find({"agent_id": int(uid)}).sort("id", -1).limit(5).to_list(5)
        for t in tx:
            t.pop("_id", None)
        return ok({"role": role, "balance": int(a.get("balance") or 0),
                   "billingFee": int(a.get("billing_fee") or 0), "recentTransactions": tx})

    if role == "kolektor":
        col = await db.collectors.find_one({"id": int(uid)})
        area = col.get("area") if col else None
        cust_ids = [c["id"] for c in await db.customers.find({"area": area}).to_list(2000)] if area else []
        unpaid = await db.invoices.find({"customer_id": {"$in": cust_ids}, "status": "unpaid"}).to_list(2000)
        collected = await db.invoices.find({"paid_by_name": f"Kolektor:{uid}"}).to_list(2000)
        now = datetime.now(timezone.utc)
        collected_month = [i for i in collected if i.get("period_month") == now.month and i.get("period_year") == now.year]
        recent = await attach_names(sorted(collected, key=lambda x: x.get("paid_at") or "", reverse=True)[:5])
        return ok({"role": role, "area": area, "assignedCustomers": len(cust_ids),
                   "unpaidCount": len(unpaid), "unpaidTotal": sum(int(i["amount"]) for i in unpaid),
                   "collectedThisMonth": sum(int(i["amount"]) for i in collected_month),
                   "collectedCountThisMonth": len(collected_month),
                   "recentCollections": [project_invoice(i) for i in recent]})

    if role == "pelanggan":
        c = await db.customers.find_one({"id": int(uid)})
        if not c:
            return err(404, "NOT_FOUND", "Pelanggan tidak ditemukan.")
        unpaid = await db.invoices.find({"customer_id": int(uid), "status": "unpaid"}).to_list(200)
        unpaid = await attach_names(unpaid)
        pkg = await db.packages.find_one({"id": c.get("package_id")}) if c.get("package_id") else None
        open_tickets = await db.tickets.count_documents({"customer_id": int(uid), "status": {"$ne": "resolved"}})
        return ok({"role": role, "serviceStatus": c.get("status"), "expiredAt": c.get("expired_at"),
                   "package": ({"id": pkg["id"], "name": pkg["name"], "price": int(pkg["price"]),
                                "speedDown": pkg.get("speed_down"), "speedUp": pkg.get("speed_up"),
                                "billingType": pkg.get("billing_type")} if pkg else None),
                   "unpaidCount": len(unpaid), "unpaidTotal": sum(int(i["amount"]) for i in unpaid),
                   "unpaidInvoices": [project_invoice(i) for i in unpaid[:3]], "openTickets": open_tickets})

    return err(403, "FORBIDDEN", "Peran tidak dikenal.")


# ----------------------------------------------------------------------------- customers (staff)
@mobile.get("/customers")
async def customers(user=Depends(get_mobile_user), q: str = "", status: str = "", limit: int = 50):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    if user["role"] not in STAFF_ROLES:
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    query = {}
    if status:
        query["status"] = status
    rows = await db.customers.find(query).to_list(2000)
    if q:
        ql = q.lower()
        rows = [c for c in rows if ql in (c.get("name", "") or "").lower() or ql in (c.get("phone", "") or "")]
    rows = rows[: max(1, min(limit, 200))]
    for c in rows:
        if c.get("package_id"):
            pkg = await db.packages.find_one({"id": c["package_id"]})
            c["package_name"] = pkg.get("name") if pkg else None
    return ok({"items": [project_customer(c) for c in rows]})


@mobile.get("/customers/{cid}")
async def customer_detail(cid: int, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    if user["role"] not in STAFF_ROLES:
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    c = await db.customers.find_one({"id": cid})
    if not c:
        return err(404, "NOT_FOUND", "Pelanggan tidak ditemukan.")
    if c.get("package_id"):
        pkg = await db.packages.find_one({"id": c["package_id"]})
        c["package_name"] = pkg.get("name") if pkg else None
    unpaid = await attach_names(await db.invoices.find({"customer_id": cid, "status": "unpaid"}).to_list(200))
    tks = await db.tickets.find({"customer_id": cid}).sort("id", -1).limit(10).to_list(10)
    tks = await attach_names(tks)
    return ok({"customer": project_customer(c), "unpaidInvoices": [project_invoice(i) for i in unpaid],
               "tickets": [project_ticket(t) for t in tks]})


# ----------------------------------------------------------------------------- invoices
@mobile.get("/invoices")
async def invoices(user=Depends(get_mobile_user), status: str = "", q: str = "", limit: int = 100):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    uid, role = user["userId"], user["role"]
    if role in STAFF_ROLES:
        query = {}
        if status:
            query["status"] = status
        rows = await db.invoices.find(query).sort("id", -1).to_list(2000)
        rows = await attach_names(rows)
        if q:
            ql = q.lower()
            rows = [i for i in rows if ql in (i.get("customer_name", "") or "").lower()]
        return ok({"items": [project_invoice(i) for i in rows[: max(1, min(limit, 300))]]})
    if role == "pelanggan":
        rows = await db.invoices.find({"customer_id": int(uid)}).sort([("period_year", -1), ("period_month", -1)]).limit(60).to_list(60)
        rows = await attach_names(rows)
        return ok({"items": [project_invoice(i) for i in rows]})
    if role == "kolektor":
        col = await db.collectors.find_one({"id": int(uid)})
        area = col.get("area") if col else None
        cust_ids = [c["id"] for c in await db.customers.find({"area": area}).to_list(2000)] if area else []
        query = {"customer_id": {"$in": cust_ids}}
        if status:
            query["status"] = status
        rows = await attach_names(await db.invoices.find(query).sort("id", -1).to_list(2000))
        return ok({"items": [project_invoice(i) for i in rows[: max(1, min(limit, 300))]]})
    return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")


@mobile.get("/invoices/{iid}")
async def invoice_detail(iid: int, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        return err(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    role, uid = user["role"], user["userId"]
    if role == "pelanggan" and str(inv["customer_id"]) != str(uid):
        return err(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    if role == "reseller":
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    if role == "kolektor":
        col = await db.collectors.find_one({"id": int(uid)})
        cust = await db.customers.find_one({"id": inv["customer_id"]})
        if not col or not cust or cust.get("area") != col.get("area"):
            return err(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    inv = (await attach_names([inv]))[0]
    return ok({"invoice": project_invoice(inv)})


@mobile.post("/invoices/{iid}/pay")
async def pay_invoice(iid: int, req: Request, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    role, uid = user["role"], user["userId"]
    if role not in PAY_ROLES:
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        return err(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    if inv["status"] == "paid":
        return err(409, "ALREADY_PAID", "Tagihan sudah lunas.")
    if role == "kolektor":
        col = await db.collectors.find_one({"id": int(uid)})
        cust = await db.customers.find_one({"id": inv["customer_id"]})
        if not col or not cust or cust.get("area") != col.get("area"):
            return err(403, "FORBIDDEN", "Pelanggan di luar area penagihan Anda.")
        paid_by = f"Kolektor:{uid}"
    else:
        paid_by = "Admin (Mobile)" if role == "admin" else "Customer Service (Mobile)"
    await db.invoices.update_one({"id": iid}, {"$set": {"status": "paid", "paid_at": now_iso(), "paid_by_name": paid_by}})
    updated = (await attach_names([await db.invoices.find_one({"id": iid})]))[0]
    return ok({"invoice": project_invoice(updated)})


@mobile.get("/invoices/{iid}/payment-link")
async def payment_link(iid: int, user=Depends(get_mobile_user)):
    if not user or user["role"] != "pelanggan":
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    inv = await db.invoices.find_one({"id": iid})
    if not inv or str(inv["customer_id"]) != str(user["userId"]):
        return err(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    if inv["status"] == "paid":
        return err(409, "ALREADY_PAID", "Tagihan sudah lunas.")
    base = os.environ.get("APP_URL", "https://pay.zenradius.net")
    token = secrets.token_urlsafe(24)
    return ok({"url": f"{base}/customer/payment/create/{iid}?t={token}",
               "statusUrl": f"{base}/customer/payment/status/{iid}?t={token}", "expiresInSeconds": 1800})


# ----------------------------------------------------------------------------- tickets
@mobile.get("/tickets")
async def tickets(user=Depends(get_mobile_user), status: str = "", scope: str = "assigned"):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    uid, role = user["userId"], user["role"]
    if role in STAFF_ROLES:
        query = {"status": status} if status else {}
        rows = await db.tickets.find(query).sort("id", -1).limit(200).to_list(200)
    elif role == "teknisi":
        if scope == "pool":
            rows = await db.tickets.find({"status": "open", "technician_id": None}).sort("id", -1).to_list(200)
        elif scope == "history":
            rows = await db.tickets.find({"technician_id": int(uid), "status": "resolved"}).sort("id", -1).to_list(200)
        else:
            rows = await db.tickets.find({"technician_id": int(uid), "status": {"$ne": "resolved"}}).sort("id", -1).to_list(200)
    elif role == "pelanggan":
        rows = await db.tickets.find({"customer_id": int(uid)}).sort("id", -1).to_list(200)
    else:
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    rows = await attach_names(rows)
    return ok({"items": [project_ticket(t) for t in rows]})


@mobile.get("/tickets/{tid}")
async def ticket_detail(tid: int, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    uid, role = user["userId"], user["role"]
    t = await db.tickets.find_one({"id": tid})
    if not t:
        return err(404, "NOT_FOUND", "Tiket tidak ditemukan.")
    if role == "pelanggan" and str(t["customer_id"]) != str(uid):
        return err(404, "NOT_FOUND", "Tiket tidak ditemukan.")
    if role == "teknisi":
        mine = str(t.get("technician_id") or "") == str(uid)
        pool = t["status"] == "open" and not t.get("technician_id")
        if not mine and not pool:
            return err(404, "NOT_FOUND", "Tiket tidak ditemukan.")
    if role in ("reseller", "kolektor"):
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    t = (await attach_names([t]))[0]
    return ok({"ticket": project_ticket(t)})


async def next_id(coll):
    last = await db[coll].find_one(sort=[("id", -1)])
    return (last["id"] + 1) if last else 1


@mobile.post("/tickets")
async def create_ticket(req: Request, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    body = await req.json()
    subject = (body.get("subject") or "").strip()
    message = (body.get("message") or "").strip()
    if len(subject) < 3:
        return err(422, "VALIDATION_ERROR", "Judul tiket minimal 3 karakter.")
    if len(message) < 5:
        return err(422, "VALIDATION_ERROR", "Deskripsi tiket minimal 5 karakter.")
    uid, role = user["userId"], user["role"]
    if role == "pelanggan":
        customer_id = int(uid)
    elif role in STAFF_ROLES:
        customer_id = int(body.get("customerId") or 0)
        if customer_id > 0 and not await db.customers.find_one({"id": customer_id}):
            return err(404, "NOT_FOUND", "Pelanggan tidak ditemukan.")
    else:
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    tid = await next_id("tickets")
    doc = {"id": tid, "customer_id": customer_id, "subject": subject[:120], "message": message[:2000],
           "status": "open", "technician_id": None, "technician_notes": None,
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.tickets.insert_one(dict(doc))
    doc = (await attach_names([doc]))[0]
    return ok201({"ticket": project_ticket(doc)})


@mobile.post("/tickets/{tid}/take")
async def take_ticket(tid: int, user=Depends(get_mobile_user)):
    if not user or user["role"] != "teknisi":
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    t = await db.tickets.find_one({"id": tid})
    if not t or t.get("technician_id") or t["status"] != "open":
        return err(409, "CONFLICT", "Tiket sudah diambil teknisi lain atau tidak tersedia.")
    await db.tickets.update_one({"id": tid}, {"$set": {"technician_id": int(user["userId"]), "status": "in_progress", "updated_at": now_iso()}})
    t = (await attach_names([await db.tickets.find_one({"id": tid})]))[0]
    return ok({"ticket": project_ticket(t)})


@mobile.post("/tickets/{tid}/status")
async def ticket_status(tid: int, req: Request, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    body = await req.json()
    status = str(body.get("status"))
    if status not in ("open", "in_progress", "resolved"):
        return err(422, "VALIDATION_ERROR", "Status tidak valid.")
    uid, role = user["userId"], user["role"]
    t = await db.tickets.find_one({"id": tid})
    if not t:
        return err(404, "NOT_FOUND", "Tiket tidak ditemukan.")
    update = {"status": status, "updated_at": now_iso()}
    if role == "teknisi":
        if str(t.get("technician_id") or "") != str(uid):
            return err(404, "NOT_FOUND", "Tiket tidak ditemukan.")
        notes = body.get("notes")
        if isinstance(notes, str):
            update["technician_notes"] = notes[:2000]
    elif role in STAFF_ROLES:
        if body.get("technicianId") is not None:
            update["technician_id"] = int(body.get("technicianId") or 0) or None
    else:
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    await db.tickets.update_one({"id": tid}, {"$set": update})
    t = (await attach_names([await db.tickets.find_one({"id": tid})]))[0]
    return ok({"ticket": project_ticket(t)})


# ----------------------------------------------------------------------------- packages
@mobile.get("/packages")
async def packages(user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    rows = await db.packages.find({"is_active": 1}).to_list(200)
    return ok({"items": [{"id": p["id"], "name": p["name"], "price": int(p["price"]),
                          "speedDown": p.get("speed_down"), "speedUp": p.get("speed_up"),
                          "billingType": p.get("billing_type"), "description": p.get("description")} for p in rows]})


# ----------------------------------------------------------------------------- reseller
@mobile.get("/reseller/transactions")
async def reseller_tx(user=Depends(get_mobile_user), limit: int = 100):
    if not user or user["role"] != "reseller":
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    rows = await db.agent_transactions.find({"agent_id": int(user["userId"])}).sort("id", -1).limit(max(1, min(limit, 300))).to_list(300)
    for r in rows:
        r.pop("_id", None)
    return ok({"items": rows})


@mobile.get("/reseller/prices")
async def reseller_prices(user=Depends(get_mobile_user)):
    if not user or user["role"] != "reseller":
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    rows = await db.packages.find({"is_active": 1}).to_list(200)
    a = await db.agents.find_one({"id": int(user["userId"])})
    fee = int(a.get("billing_fee") or 0) if a else 0
    return ok({"items": [{"packageId": p["id"], "name": p["name"], "price": int(p["price"]),
                          "resellerPrice": max(int(p["price"]) - fee, 0)} for p in rows]})


@mobile.get("/reseller/invoice-lookup")
async def reseller_lookup(user=Depends(get_mobile_user), q: str = ""):
    if not user or user["role"] != "reseller":
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    q = q.strip()
    if len(q) < 4:
        return err(422, "VALIDATION_ERROR", "Kata kunci minimal 4 karakter.")
    custs = await db.customers.find({"$or": [{"phone": {"$regex": q}}, {"name": {"$regex": q, "$options": "i"}}]}).to_list(200)
    ids = [c["id"] for c in custs]
    rows = await attach_names(await db.invoices.find({"customer_id": {"$in": ids}, "status": "unpaid"}).to_list(200))
    return ok({"items": [project_invoice(i) for i in rows]})


@mobile.post("/reseller/pay-invoice")
async def reseller_pay(req: Request, user=Depends(get_mobile_user)):
    if not user or user["role"] != "reseller":
        return err(403, "FORBIDDEN", "Anda tidak memiliki akses ke resource ini.")
    body = await req.json()
    iid = int(body.get("invoiceId") or 0)
    if iid <= 0:
        return err(422, "VALIDATION_ERROR", "invoiceId tidak valid.")
    note = (body.get("note") or "")[:200]
    agent = await db.agents.find_one({"id": int(user["userId"])})
    inv = await db.invoices.find_one({"id": iid})
    if not inv:
        return err(404, "NOT_FOUND", "Tagihan tidak ditemukan.")
    if inv["status"] == "paid":
        return err(409, "CONFLICT", "Tagihan sudah lunas.")
    amount = int(inv["amount"])
    fee = int(agent.get("billing_fee") or 0)
    cost = max(amount - fee, 0)
    if int(agent.get("balance") or 0) < cost:
        return err(409, "CONFLICT", "Saldo tidak mencukupi.")
    bal_before = int(agent.get("balance") or 0)
    bal_after = bal_before - cost
    await db.agents.update_one({"id": agent["id"]}, {"$set": {"balance": bal_after}})
    await db.invoices.update_one({"id": iid}, {"$set": {"status": "paid", "paid_at": now_iso(), "paid_by_name": f"Reseller:{agent['name']}"}})
    txid = await next_id("agent_transactions")
    cust = await db.customers.find_one({"id": inv["customer_id"]})
    await db.agent_transactions.insert_one({"id": txid, "agent_id": agent["id"], "type": "pay_invoice",
                                            "invoice_id": iid, "customer_id": inv["customer_id"],
                                            "customer_name": cust.get("name") if cust else None,
                                            "amount_invoice": amount, "amount_buy": cost, "fee": fee,
                                            "balance_before": bal_before, "balance_after": bal_after,
                                            "note": note, "created_at": now_iso()})
    updated = (await attach_names([await db.invoices.find_one({"id": iid})]))[0]
    return ok({"result": {"balanceAfter": bal_after}, "invoice": project_invoice(updated)})


# ----------------------------------------------------------------------------- notifications & profile & push
@mobile.get("/notifications")
async def notifications(user=Depends(get_mobile_user), limit: int = 50):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    rows = await db.notification_events.find({"user_id": str(user["userId"]), "role": user["role"]}).sort("id", -1).limit(max(1, min(limit, 100))).to_list(100)
    for r in rows:
        r.pop("_id", None)
    return ok({"notifications": rows})


@mobile.post("/profile/change-password")
async def change_password(req: Request, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    role, uid = user["role"], user["userId"]
    if role == "admin":
        return err(409, "NOT_SUPPORTED", "Kata sandi Administrator dikelola melalui Pengaturan pada Web Panel.")
    body = await req.json()
    cur = body.get("currentPassword")
    new = body.get("newPassword")
    conf = body.get("confirmPassword")
    if not cur or not new or not conf:
        return err(422, "VALIDATION_ERROR", "Semua field harus diisi.")
    if not isinstance(new, str) or len(new) < 8:
        return err(422, "VALIDATION_ERROR", "Kata sandi baru minimal 8 karakter.")
    if new != conf:
        return err(422, "VALIDATION_ERROR", "Konfirmasi kata sandi tidak cocok.")
    if new == cur:
        return err(422, "VALIDATION_ERROR", "Kata sandi baru harus berbeda dari kata sandi saat ini.")
    if role == "pelanggan":
        c = await db.customers.find_one({"id": int(uid)})
        if not c:
            return err(404, "NOT_FOUND", "Pelanggan tidak ditemukan.")
        if not pwd.verify(cur, c.get("portal_password") or ""):
            return err(401, "INVALID_CREDENTIALS", "Kata sandi saat ini tidak sesuai.")
        await db.customers.update_one({"id": int(uid)}, {"$set": {"portal_password": pwd.hash(new)}})
    else:
        table = {"teknisi": "technicians", "customer_service": "cashiers", "kolektor": "collectors", "reseller": "agents"}[role]
        row = await db[table].find_one({"id": int(uid)})
        if not row:
            return err(404, "NOT_FOUND", "Akun tidak ditemukan.")
        if not pwd.verify(cur, row.get("password") or ""):
            return err(401, "INVALID_CREDENTIALS", "Kata sandi saat ini tidak sesuai.")
        await db[table].update_one({"id": int(uid)}, {"$set": {"password": pwd.hash(new)}})
    await db.mobile_sessions.update_many({"user_id": str(uid)}, {"$set": {"revoked": True}})
    return ok({"changed": True, "reloginRequired": True})


@mobile.get("/push/config")
async def push_config(user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    return ok({"enabled": False, "projectId": None, "appId": None, "apiKey": None, "senderId": None})


@mobile.post("/push/register")
async def push_register(req: Request, user=Depends(get_mobile_user)):
    if not user:
        return err(401, "AUTH_REQUIRED", "Silakan login terlebih dahulu.")
    body = await req.json()
    if not body.get("fcmToken"):
        return err(422, "VALIDATION_ERROR", "fcmToken harus diisi.")
    return ok({"registered": True})


app.include_router(api)
app.include_router(mobile)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ----------------------------------------------------------------------------- seed
async def seed():
    if await db.packages.count_documents({}) > 0:
        return
    logger.info("[seed] seeding ZenRadius reference data ...")
    await db.packages.insert_many([
        {"id": 3, "name": "HOME", "price": 111000, "speed_down": 50000, "speed_up": 50000, "billing_type": "postpaid", "description": "Internet rumah 50 Mbps", "is_active": 1},
        {"id": 4, "name": "FAMILY", "price": 166500, "speed_down": 100000, "speed_up": 100000, "billing_type": "postpaid", "description": "Internet keluarga 100 Mbps", "is_active": 1},
        {"id": 5, "name": "ULTRA", "price": 222000, "speed_down": 200000, "speed_up": 200000, "billing_type": "postpaid", "description": "Internet ultra 200 Mbps", "is_active": 1},
    ])
    h = pwd.hash
    await db.cashiers.insert_one({"id": 1, "username": "kasir", "password": h("kasir123"), "name": "Dewi Kasir", "phone": "081300000001", "is_active": 1, "created_at": now_iso()})
    await db.technicians.insert_one({"id": 1, "username": "teknisi", "password": h("teknisi123"), "name": "Rizky Teknisi", "phone": "081300000002", "area": "Jakarta Pusat", "is_active": 1, "created_at": now_iso()})
    await db.collectors.insert_one({"id": 1, "username": "kolektor", "password": h("kolektor123"), "name": "Agus Penagih", "phone": "081300000003", "area": "Jakarta Pusat", "is_active": 1, "auto_approve": 0, "created_at": now_iso()})
    await db.agents.insert_one({"id": 1, "username": "reseller", "password": h("reseller123"), "name": "Mitra Jaya Net", "phone": "081300000004", "balance": 500000, "billing_fee": 5000, "is_active": 1, "created_at": now_iso()})

    areas = ["Jakarta Pusat", "Bandung", "Surabaya"]
    names = ["Budi Santoso", "Siti Aminah", "Joko Widodo", "Rina Melati", "Andi Pratama", "Maya Sari", "Hendra Gunawan", "Lia Permata"]
    customers = []
    for i, nm in enumerate(names):
        cid = 101 + i
        customers.append({
            "id": cid, "name": nm, "phone": f"0812000000{i:02d}", "email": f"user{i}@mail.com",
            "address": f"Jl. Merdeka No.{i+1}", "area": areas[i % 3], "package_id": [3, 4, 5][i % 3],
            "pppoe_username": f"zr{cid}", "status": "active" if i % 4 != 3 else "suspended",
            "connection_type": "pppoe", "install_date": "2024-01-15", "expired_at": "2026-07-20",
            "portal_password": h("pelanggan123"), "collector_id": 1 if areas[i % 3] == "Jakarta Pusat" else None,
            "created_at": now_iso(),
        })
    await db.customers.insert_many(customers)

    inv_id = 1
    invs = []
    now = datetime.now(timezone.utc)
    for c in customers:
        price = {3: 111000, 4: 166500, 5: 222000}[c["package_id"]]
        for back in range(3):
            d = now - timedelta(days=30 * back)
            status = "paid" if back > 0 else ("unpaid" if c["id"] % 2 == 1 else "paid")
            inv = {"id": inv_id, "customer_id": c["id"], "period_month": d.month, "period_year": d.year,
                   "amount": price, "status": status, "created_at": now_iso()}
            if status == "paid":
                inv["paid_at"] = (d - timedelta(days=2)).isoformat()
                inv["paid_by_name"] = "Admin"
            invs.append(inv)
            inv_id += 1
    await db.invoices.insert_many(invs)

    tks = [
        {"id": 1, "customer_id": 101, "subject": "Internet lambat", "message": "Kecepatan turun sejak kemarin malam.", "status": "open", "technician_id": None, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": 2, "customer_id": 103, "subject": "Tidak bisa connect", "message": "Modem tidak dapat IP, lampu LOS merah.", "status": "in_progress", "technician_id": 1, "technician_notes": "Cek redaman ODP.", "created_at": now_iso(), "updated_at": now_iso()},
        {"id": 3, "customer_id": 105, "subject": "Pindah titik router", "message": "Minta bantuan pindah posisi router ke lantai 2.", "status": "resolved", "technician_id": 1, "technician_notes": "Selesai, rapikan kabel.", "created_at": now_iso(), "updated_at": now_iso()},
        {"id": 4, "customer_id": 102, "subject": "WiFi sering putus", "message": "Koneksi WiFi putus-putus di malam hari.", "status": "open", "technician_id": None, "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.tickets.insert_many(tks)
    await db.agent_transactions.insert_one({"id": 1, "agent_id": 1, "type": "topup", "amount_buy": 500000,
                                            "balance_before": 0, "balance_after": 500000, "note": "Top up awal saldo",
                                            "created_at": now_iso()})
    logger.info("[seed] done.")


@app.on_event("startup")
async def on_startup():
    await db.mobile_sessions.create_index("access_hash")
    await db.mobile_sessions.create_index("refresh_hash")
    await seed()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
