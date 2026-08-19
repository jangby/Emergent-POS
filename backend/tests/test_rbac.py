"""RBAC Backend Tests: Owner vs Cashier permissions."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pintar-inventory.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "robaya05@gmail.com"
OWNER_PASSWORD = "admin123"

TS = int(time.time())
CASHIER_EMAIL = f"e2e_cashier_{TS}@test.com"
CASHIER_PASSWORD = "secret123"
CASHIER_NAME = "E2E Cashier"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


@pytest.fixture(scope="module")
def owner_ctx():
    r = _login(OWNER_EMAIL, OWNER_PASSWORD)
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text}"
    data = r.json()
    for k in ["id", "email", "name", "role", "tenant_id", "access_token"]:
        assert k in data, f"Missing key {k} in owner login response"
    assert data["role"] == "owner"
    assert data["tenant_id"] == data["id"]
    return {
        "token": data["access_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "user": data,
    }


@pytest.fixture(scope="module")
def cashier_ctx(owner_ctx):
    # Create cashier
    r = requests.post(
        f"{API}/users/cashier",
        json={"email": CASHIER_EMAIL, "password": CASHIER_PASSWORD, "name": CASHIER_NAME},
        headers=owner_ctx["headers"],
        timeout=30,
    )
    assert r.status_code == 200, f"Cashier create failed: {r.status_code} {r.text}"
    created = r.json()
    # Login as cashier
    r2 = _login(CASHIER_EMAIL, CASHIER_PASSWORD)
    assert r2.status_code == 200, f"Cashier login failed: {r2.status_code} {r2.text}"
    d = r2.json()
    for k in ["id", "email", "name", "role", "tenant_id", "access_token"]:
        assert k in d, f"Missing key {k} in cashier login response"
    assert d["role"] == "cashier"
    assert d["tenant_id"] == owner_ctx["user"]["tenant_id"], "Cashier tenant_id must equal owner tenant_id"
    return {
        "token": d["access_token"],
        "headers": {"Authorization": f"Bearer {d['access_token']}"},
        "user": d,
        "created": created,
    }


# ---------- Login response shape ----------
class TestLoginShape:
    def test_owner_login_shape(self, owner_ctx):
        assert owner_ctx["user"]["role"] == "owner"

    def test_cashier_login_shape_and_shared_tenant(self, cashier_ctx, owner_ctx):
        assert cashier_ctx["user"]["role"] == "cashier"
        assert cashier_ctx["user"]["tenant_id"] == owner_ctx["user"]["tenant_id"]


# ---------- Cashier 403 endpoints ----------
FORBIDDEN_GET = [
    "/analytics/summary",
    "/analytics/net-profit",
    "/analytics/cashier-leaderboard",
    "/expenses",
    "/exports/transactions.xlsx",
    "/exports/inventory.xlsx",
    "/exports/shifts.xlsx",
    "/ai/suggest-bundles",
    "/ai/insights",
    "/online-orders",
    "/users",
]

FORBIDDEN_POST = [
    ("/products", {"name": "x", "price": 1, "stock": 1}),
    ("/products/import", {}),
    ("/products/generate-sku", {"name": "x"}),
    ("/settings/gemini/test", {}),
    ("/expenses", {"description": "x", "amount": 1}),
    ("/promotions", {"name": "x"}),
    ("/ai/scan-receipt", {}),
    ("/ai/confirm-restock", {}),
    ("/ai/apply-bundle", {}),
    ("/ai/parse-order", {"text": "x"}),
    ("/whatsapp/send", {"to": "0", "message": "hi"}),
    ("/whatsapp/send-receipt", {}),
    ("/users/cashier", {"email": "a@b.com", "password": "x", "name": "y"}),
]

FORBIDDEN_PUT = [
    ("/products/nonexistent", {"name": "x"}),
    ("/settings/store", {"store_name": "x"}),
    ("/settings/midtrans", {}),
    ("/settings/fonnte", {}),
    ("/settings/gemini", {"api_key": "AIzaFAKE"}),
    ("/settings/branding", {}),
    ("/promotions/nonexistent", {}),
    ("/users/nonexistent", {"password": "x"}),
]

FORBIDDEN_DELETE = [
    "/products/nonexistent",
    "/settings/gemini",
    "/settings/branding",
    "/expenses/nonexistent",
    "/promotions/nonexistent",
    "/users/nonexistent",
]


class TestCashierForbidden:
    @pytest.mark.parametrize("path", FORBIDDEN_GET)
    def test_get_forbidden(self, cashier_ctx, path):
        r = requests.get(f"{API}{path}", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 403, f"GET {path} expected 403, got {r.status_code}: {r.text[:200]}"

    @pytest.mark.parametrize("path,body", FORBIDDEN_POST)
    def test_post_forbidden(self, cashier_ctx, path, body):
        r = requests.post(f"{API}{path}", json=body, headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 403, f"POST {path} expected 403, got {r.status_code}: {r.text[:200]}"

    @pytest.mark.parametrize("path,body", FORBIDDEN_PUT)
    def test_put_forbidden(self, cashier_ctx, path, body):
        r = requests.put(f"{API}{path}", json=body, headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 403, f"PUT {path} expected 403, got {r.status_code}: {r.text[:200]}"

    @pytest.mark.parametrize("path", FORBIDDEN_DELETE)
    def test_delete_forbidden(self, cashier_ctx, path):
        r = requests.delete(f"{API}{path}", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 403, f"DELETE {path} expected 403, got {r.status_code}: {r.text[:200]}"

    def test_customer_send_reminder_forbidden(self, cashier_ctx):
        r = requests.post(f"{API}/customers/nonexistent/send-reminder", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 403

    def test_online_orders_mark_shipped_forbidden(self, cashier_ctx):
        r = requests.post(f"{API}/online-orders/nonexistent/mark-shipped", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 403

    def test_whatsapp_simulate_payment_forbidden(self, cashier_ctx):
        r = requests.post(f"{API}/whatsapp/simulate-payment/nonexistent", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 403


# ---------- Cashier ALLOWED endpoints ----------
class TestCashierAllowed:
    def test_get_products(self, cashier_ctx):
        r = requests.get(f"{API}/products", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 200

    def test_get_products_categories(self, cashier_ctx):
        r = requests.get(f"{API}/products/categories", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 200

    def test_get_settings_read(self, cashier_ctx):
        r = requests.get(f"{API}/settings", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 200

    def test_get_branding_read(self, cashier_ctx):
        r = requests.get(f"{API}/settings/branding", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 200

    def test_get_promotions_read(self, cashier_ctx):
        r = requests.get(f"{API}/promotions", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 200

    def test_promotions_preview(self, cashier_ctx):
        r = requests.post(
            f"{API}/promotions/preview",
            json={"items": [], "subtotal": 0},
            headers=cashier_ctx["headers"],
            timeout=30,
        )
        assert r.status_code == 200

    def test_list_transactions(self, cashier_ctx):
        r = requests.get(f"{API}/transactions", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 200

    def test_get_customers(self, cashier_ctx):
        r = requests.get(f"{API}/customers", headers=cashier_ctx["headers"], timeout=30)
        assert r.status_code == 200

    def test_shift_and_transaction_flow(self, cashier_ctx, owner_ctx):
        # Ensure at least one product exists (as owner) so cashier can transact
        prods = requests.get(f"{API}/products", headers=cashier_ctx["headers"], timeout=30).json()
        if not prods:
            # Create one product via owner
            cr = requests.post(
                f"{API}/products",
                json={"name": "TEST_ItemRBAC", "price": 1000, "stock": 100, "category": "TEST"},
                headers=owner_ctx["headers"],
                timeout=30,
            )
            assert cr.status_code in (200, 201), cr.text
            prods = requests.get(f"{API}/products", headers=cashier_ctx["headers"], timeout=30).json()
        assert prods, "No products available"
        p = prods[0]
        price = p.get("price") or p.get("sell_price") or 0

        # Close any existing open shift (defensive)
        cur = requests.get(f"{API}/shifts/current", headers=cashier_ctx["headers"], timeout=30)
        if cur.status_code == 200 and cur.json():
            requests.post(
                f"{API}/shifts/close",
                json={"closing_cash_actual": 0},
                headers=cashier_ctx["headers"],
                timeout=30,
            )

        # Open shift
        ro = requests.post(
            f"{API}/shifts/open",
            json={"opening_cash": 50000},
            headers=cashier_ctx["headers"],
            timeout=30,
        )
        assert ro.status_code == 200, f"Shift open failed: {ro.status_code} {ro.text[:200]}"

        # Get current
        rc = requests.get(f"{API}/shifts/current", headers=cashier_ctx["headers"], timeout=30)
        assert rc.status_code == 200

        # Create transaction
        tx_payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": price, "quantity": 1, "qty": 1}],
            "subtotal": price,
            "discount": 0,
            "tax": 0,
            "total": price,
            "payment_method": "cash",
            "amount_paid": price,
            "change": 0,
        }
        rt = requests.post(f"{API}/transactions", json=tx_payload, headers=cashier_ctx["headers"], timeout=30)
        assert rt.status_code in (200, 201), f"Transaction failed: {rt.status_code} {rt.text[:300]}"

        # Close shift
        rcl = requests.post(
            f"{API}/shifts/close",
            json={"closing_cash_actual": 50000},
            headers=cashier_ctx["headers"],
            timeout=30,
        )
        assert rcl.status_code == 200, f"Shift close failed: {rcl.status_code} {rcl.text[:200]}"


# ---------- Owner user management ----------
class TestOwnerUserManagement:
    def test_list_users(self, owner_ctx, cashier_ctx):
        r = requests.get(f"{API}/users", headers=owner_ctx["headers"], timeout=30)
        assert r.status_code == 200
        emails = [u.get("email") for u in r.json()]
        assert CASHIER_EMAIL in emails

    def test_owner_reset_cashier_password_and_delete(self, owner_ctx, cashier_ctx):
        cashier_id = cashier_ctx["user"]["id"]
        new_pw = "newpw12345"
        # Update password
        r = requests.put(
            f"{API}/users/{cashier_id}",
            json={"password": new_pw},
            headers=owner_ctx["headers"],
            timeout=30,
        )
        assert r.status_code == 200, f"PUT /users/{{id}} failed: {r.text[:200]}"

        # Login with new pw
        rlogin = _login(CASHIER_EMAIL, new_pw)
        assert rlogin.status_code == 200, f"New pw login failed: {rlogin.text[:200]}"

        # Delete cashier
        rdel = requests.delete(f"{API}/users/{cashier_id}", headers=owner_ctx["headers"], timeout=30)
        assert rdel.status_code == 200, f"DELETE /users/{{id}} failed: {rdel.text[:200]}"

        # Deleted cashier can't log in
        rf = _login(CASHIER_EMAIL, new_pw)
        assert rf.status_code == 401, f"Deleted cashier login should be 401, got {rf.status_code}"
