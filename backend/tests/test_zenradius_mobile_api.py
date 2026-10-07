"""ZenRadius Mobile API v1 — backend contract & RBAC tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api/mobile/v1"

CREDS = {
    "admin": ("zenradius", "zenradius123"),
    "customer_service": ("kasir", "kasir123"),
    "teknisi": ("teknisi", "teknisi123"),
    "reseller": ("reseller", "reseller123"),
    "kolektor": ("kolektor", "kolektor123"),
    "pelanggan": ("081200000000", "pelanggan123"),
    "pelanggan2": ("081200000001", "pelanggan123"),
}


@pytest.fixture(scope="session")
def tokens():
    out = {}
    for role, (ident, pw) in CREDS.items():
        r = requests.post(f"{API}/auth/login", json={"identifier": ident, "password": pw}, timeout=15)
        assert r.status_code == 200, f"login failed for {role}: {r.text}"
        d = r.json()["data"]
        out[role] = {"token": d["accessToken"], "refresh": d["refreshToken"], "userId": d["userId"], "role": d["role"]}
    return out


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- health & envelope
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["success"] is True and j["data"]["status"] == "ok" and j["data"]["apiVersion"] == "v1"


def test_login_invalid_credentials():
    r = requests.post(f"{API}/auth/login", json={"identifier": "nope", "password": "nope"}, timeout=10)
    assert r.status_code == 401
    j = r.json()
    assert j["success"] is False and j["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_validation_missing():
    r = requests.post(f"{API}/auth/login", json={"identifier": "", "password": ""}, timeout=10)
    assert r.status_code == 422


# ---- auth required
@pytest.mark.parametrize("path", ["/me", "/dashboard", "/customers", "/invoices", "/tickets", "/packages", "/notifications"])
def test_unauth_denied(path):
    r = requests.get(f"{API}{path}", timeout=10)
    assert r.status_code == 401


def test_invalid_token_401():
    r = requests.get(f"{API}/me", headers=h("badtoken"), timeout=10)
    assert r.status_code == 401


# ---- me per role
@pytest.mark.parametrize("role", ["admin", "customer_service", "teknisi", "reseller", "kolektor", "pelanggan"])
def test_me(tokens, role):
    r = requests.get(f"{API}/me", headers=h(tokens[role]["token"]), timeout=10)
    assert r.status_code == 200
    j = r.json()["data"]
    assert j["role"] == role


# ---- refresh (uses a fresh dedicated session to avoid rotating shared admin token)
def test_refresh():
    r = requests.post(f"{API}/auth/login", json={"identifier": "kasir", "password": "kasir123"}, timeout=10)
    rt = r.json()["data"]["refreshToken"]
    r2 = requests.post(f"{API}/auth/refresh", json={"refreshToken": rt}, timeout=10)
    assert r2.status_code == 200
    assert "accessToken" in r2.json()["data"]


def test_refresh_invalid():
    r = requests.post(f"{API}/auth/refresh", json={"refreshToken": "bad"}, timeout=10)
    assert r.status_code == 401


# ---- dashboard per role
@pytest.mark.parametrize("role", ["admin", "customer_service", "teknisi", "reseller", "kolektor", "pelanggan"])
def test_dashboard(tokens, role):
    r = requests.get(f"{API}/dashboard", headers=h(tokens[role]["token"]), timeout=15)
    assert r.status_code == 200
    j = r.json()["data"]
    assert j["role"] == role


# ---- customers (staff only)
def test_customers_staff(tokens):
    r = requests.get(f"{API}/customers", headers=h(tokens["admin"]["token"]), timeout=10)
    assert r.status_code == 200
    assert len(r.json()["data"]["items"]) > 0


@pytest.mark.parametrize("role", ["teknisi", "reseller", "kolektor", "pelanggan"])
def test_customers_forbidden(tokens, role):
    r = requests.get(f"{API}/customers", headers=h(tokens[role]["token"]), timeout=10)
    assert r.status_code == 403


def test_customer_detail(tokens):
    r = requests.get(f"{API}/customers/101", headers=h(tokens["customer_service"]["token"]), timeout=10)
    assert r.status_code == 200
    assert r.json()["data"]["customer"]["id"] == 101


# ---- invoices + IDOR
def test_invoices_pelanggan_own_only(tokens):
    tok = tokens["pelanggan"]["token"]
    uid = tokens["pelanggan"]["userId"]
    r = requests.get(f"{API}/invoices", headers=h(tok), timeout=10)
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    for i in items:
        assert str(i["customerId"]) == str(uid)


def test_invoice_idor_pelanggan_cannot_read_other(tokens):
    # pelanggan[0] is 081200000000 => id 101. Try to read invoice of 103 (odd => has unpaid).
    # Need an invoice id belonging to another customer. Get list via admin.
    adm = tokens["admin"]["token"]
    r = requests.get(f"{API}/invoices", headers=h(adm), timeout=10)
    others = [i for i in r.json()["data"]["items"] if str(i["customerId"]) != str(tokens["pelanggan"]["userId"])]
    assert others, "need an invoice from a different customer"
    other_id = others[0]["id"]
    r2 = requests.get(f"{API}/invoices/{other_id}", headers=h(tokens["pelanggan"]["token"]), timeout=10)
    assert r2.status_code == 404


def test_reseller_invoices_forbidden(tokens):
    r = requests.get(f"{API}/invoices", headers=h(tokens["reseller"]["token"]), timeout=10)
    assert r.status_code == 403


# ---- payment RBAC
def test_pay_invoice_by_reseller_forbidden(tokens):
    adm = tokens["admin"]["token"]
    inv_list = requests.get(f"{API}/invoices?status=unpaid", headers=h(adm), timeout=10).json()["data"]["items"]
    assert inv_list, "need unpaid invoice"
    iid = inv_list[0]["id"]
    r = requests.post(f"{API}/invoices/{iid}/pay", headers=h(tokens["reseller"]["token"]), timeout=10)
    assert r.status_code == 403


def test_pay_invoice_by_admin(tokens):
    adm = tokens["admin"]["token"]
    inv_list = requests.get(f"{API}/invoices?status=unpaid", headers=h(adm), timeout=10).json()["data"]["items"]
    if not inv_list:
        pytest.skip("no unpaid invoices")
    iid = inv_list[-1]["id"]  # take a different one than reseller/kolektor flows
    r = requests.post(f"{API}/invoices/{iid}/pay", headers=h(adm), timeout=10)
    assert r.status_code == 200
    assert r.json()["data"]["invoice"]["status"] == "paid"
    # verify via GET
    g = requests.get(f"{API}/invoices/{iid}", headers=h(adm), timeout=10).json()["data"]["invoice"]
    assert g["status"] == "paid"


def test_payment_link_pelanggan(tokens):
    tok = tokens["pelanggan"]["token"]
    uid = tokens["pelanggan"]["userId"]
    inv_list = requests.get(f"{API}/invoices", headers=h(tok), timeout=10).json()["data"]["items"]
    unpaid = [i for i in inv_list if i["status"] == "unpaid"]
    if not unpaid:
        pytest.skip("no unpaid")
    r = requests.get(f"{API}/invoices/{unpaid[0]['id']}/payment-link", headers=h(tok), timeout=10)
    assert r.status_code == 200
    assert "url" in r.json()["data"]


# ---- tickets
def test_create_ticket_pelanggan(tokens):
    r = requests.post(f"{API}/tickets", headers=h(tokens["pelanggan"]["token"]),
                      json={"subject": "TEST subject", "message": "TEST created from automation."}, timeout=10)
    assert r.status_code == 200 or r.status_code == 201
    tid = r.json()["data"]["ticket"]["id"]
    # verify get
    r2 = requests.get(f"{API}/tickets/{tid}", headers=h(tokens["pelanggan"]["token"]), timeout=10)
    assert r2.status_code == 200


def test_teknisi_take_and_resolve(tokens):
    tek = tokens["teknisi"]["token"]
    # find an open-pool ticket
    pool = requests.get(f"{API}/tickets?scope=pool", headers=h(tek), timeout=10).json()["data"]["items"]
    if not pool:
        pytest.skip("no open pool ticket")
    tid = pool[0]["id"]
    r = requests.post(f"{API}/tickets/{tid}/take", headers=h(tek), timeout=10)
    assert r.status_code == 200
    assert r.json()["data"]["ticket"]["status"] == "in_progress"
    r2 = requests.post(f"{API}/tickets/{tid}/status", headers=h(tek),
                       json={"status": "resolved", "notes": "TEST done"}, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["data"]["ticket"]["status"] == "resolved"


def test_tickets_reseller_forbidden(tokens):
    r = requests.get(f"{API}/tickets", headers=h(tokens["reseller"]["token"]), timeout=10)
    assert r.status_code == 403


# ---- packages
def test_packages(tokens):
    r = requests.get(f"{API}/packages", headers=h(tokens["admin"]["token"]), timeout=10)
    assert r.status_code == 200
    assert len(r.json()["data"]["items"]) >= 1


# ---- reseller flows
def test_reseller_prices(tokens):
    r = requests.get(f"{API}/reseller/prices", headers=h(tokens["reseller"]["token"]), timeout=10)
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert items and "resellerPrice" in items[0]


def test_reseller_lookup_min_chars(tokens):
    r = requests.get(f"{API}/reseller/invoice-lookup?q=abc", headers=h(tokens["reseller"]["token"]), timeout=10)
    assert r.status_code == 422


def test_reseller_pay_balance_decrement(tokens):
    tok = tokens["reseller"]["token"]
    # Get balance before
    me = requests.get(f"{API}/me", headers=h(tok), timeout=10).json()["data"]
    bal_before = int(me["balance"])
    # Lookup unpaid by phone of pelanggan2 (081200000001 => odd => has unpaid)
    r = requests.get(f"{API}/reseller/invoice-lookup?q=0812", headers=h(tok), timeout=10)
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    if not items:
        pytest.skip("no unpaid available for reseller lookup")
    iid = items[0]["id"]
    amount = items[0]["amount"]
    p = requests.post(f"{API}/reseller/pay-invoice", headers=h(tok), json={"invoiceId": iid, "note": "TEST"}, timeout=10)
    assert p.status_code == 200, p.text
    bal_after = p.json()["data"]["result"]["balanceAfter"]
    # fee=5000 so cost = amount - 5000
    assert bal_after == bal_before - (amount - 5000)


def test_reseller_endpoints_forbidden_for_others(tokens):
    r = requests.get(f"{API}/reseller/transactions", headers=h(tokens["admin"]["token"]), timeout=10)
    assert r.status_code == 403


# ---- notifications
def test_notifications(tokens):
    r = requests.get(f"{API}/notifications", headers=h(tokens["admin"]["token"]), timeout=10)
    assert r.status_code == 200
    assert "notifications" in r.json()["data"]


# ---- change password
def test_change_password_admin_blocked(tokens):
    r = requests.post(f"{API}/profile/change-password", headers=h(tokens["admin"]["token"]),
                      json={"currentPassword": "x", "newPassword": "yyyyyyyy", "confirmPassword": "yyyyyyyy"}, timeout=10)
    assert r.status_code == 409


# ---- logout
def test_logout(tokens):
    # separate login so we don't invalidate shared session
    r = requests.post(f"{API}/auth/login", json={"identifier": "kasir", "password": "kasir123"}, timeout=10)
    tok = r.json()["data"]["accessToken"]
    r2 = requests.post(f"{API}/auth/logout", headers=h(tok), timeout=10)
    assert r2.status_code == 200
    # subsequent /me must be 401
    r3 = requests.get(f"{API}/me", headers=h(tok), timeout=10)
    assert r3.status_code == 401
