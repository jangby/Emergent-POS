"""Tests for the per-tenant dynamic branding endpoints.

Covers:
- GET /api/settings/branding defaults
- PUT /api/settings/branding save + validation (hex color, lengths, logo size)
- Server-side Pillow resize to 512x512
- GET /api/settings top-level `branding` block
- DELETE /api/settings/branding reset
- Tenant isolation between admin and a fresh registered user
"""
import base64
import io
import os
import time
import uuid
import pytest
import requests
from PIL import Image

def _load_frontend_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip()
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _load_frontend_backend_url().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "robaya05@gmail.com"
ADMIN_PASSWORD = "admin123"


def _login(session: requests.Session, email: str, password: str) -> str:
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in login response: {data}"
    session.headers.update({"Authorization": f"Bearer {tok}"})
    return tok


def _make_png_data_url(w: int, h: int, color=(255, 0, 0, 255)) -> str:
    img = Image.new("RGBA", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    yield s
    # Cleanup: reset admin branding
    try:
        s.delete(f"{API}/settings/branding")
    except Exception:
        pass


@pytest.fixture(scope="module")
def new_tenant_session():
    s = requests.Session()
    email = f"TEST_brand_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email,
        "password": "test1234",
        "name": "Test Brand Tenant",
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    # Some auth impls return token from register; also do a login to be safe
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    else:
        _login(s, email, "test1234")
    yield s
    try:
        s.delete(f"{API}/settings/branding")
    except Exception:
        pass


class TestBrandingDefaults:
    def test_defaults_for_new_tenant(self, new_tenant_session):
        r = new_tenant_session.get(f"{API}/settings/branding")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["app_name"] == "KasirPintar AI"
        assert d["short_name"] == "KasirPintar"
        assert d["theme_color"] == "#e85d04"
        assert d["logo_base64"] == ""

    def test_settings_includes_branding_block(self, new_tenant_session):
        r = new_tenant_session.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert "branding" in d
        b = d["branding"]
        for k in ("app_name", "short_name", "theme_color", "logo_base64", "updated_at"):
            assert k in b, f"missing {k} in branding block"


class TestBrandingSaveAndValidate:
    def test_put_valid(self, new_tenant_session):
        payload = {
            "app_name": "Kasir Toko Berkah",
            "short_name": "Berkah",
            "theme_color": "#0ea5e9",
            "logo_base64": "",
        }
        r = new_tenant_session.put(f"{API}/settings/branding", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["app_name"] == "Kasir Toko Berkah"
        assert d["short_name"] == "Berkah"
        assert d["theme_color"] == "#0ea5e9"
        # persistence
        g = new_tenant_session.get(f"{API}/settings/branding").json()
        assert g["short_name"] == "Berkah"
        assert g["app_name"] == "Kasir Toko Berkah"

    def test_invalid_hex_color(self, new_tenant_session):
        r = new_tenant_session.put(f"{API}/settings/branding", json={
            "app_name": "Ok", "short_name": "Ok", "theme_color": "orange", "logo_base64": ""
        })
        assert r.status_code == 400, r.text
        assert "hex" in r.json().get("detail", "").lower()

    def test_short_name_too_long(self, new_tenant_session):
        r = new_tenant_session.put(f"{API}/settings/branding", json={
            "app_name": "Ok", "short_name": "WayTooLongName123", "theme_color": "#123456"
        })
        assert r.status_code == 422, r.text

    def test_app_name_too_long(self, new_tenant_session):
        r = new_tenant_session.put(f"{API}/settings/branding", json={
            "app_name": "X" * 31, "short_name": "Ok", "theme_color": "#123456"
        })
        assert r.status_code == 422, r.text

    def test_logo_too_large(self, new_tenant_session):
        # Build a payload string > 800_000 chars but with data:image prefix so it
        # goes through the resize branch. Use random bytes that PIL can't decode,
        # which triggers the except path leaving `logo` as-is → then the size
        # check trips.
        big = "A" * 900_000
        payload = {
            "app_name": "Ok",
            "short_name": "Ok",
            "theme_color": "#123456",
            "logo_base64": f"data:image/png;base64,{big}",
        }
        r = new_tenant_session.put(f"{API}/settings/branding", json=payload)
        assert r.status_code == 400, r.text
        assert "besar" in r.json().get("detail", "").lower() or "large" in r.json().get("detail", "").lower()


class TestBrandingResize:
    def test_100x100_png_resized_to_512(self, new_tenant_session):
        data_url = _make_png_data_url(100, 100, (10, 200, 50, 255))
        r = new_tenant_session.put(f"{API}/settings/branding", json={
            "app_name": "Resz",
            "short_name": "Resz",
            "theme_color": "#00aa00",
            "logo_base64": data_url,
        })
        assert r.status_code == 200, r.text
        returned = r.json()["logo_base64"]
        assert returned.startswith("data:image/png;base64,"), returned[:40]
        _, b64 = returned.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        assert img.size == (512, 512), f"expected 512x512, got {img.size}"


class TestBrandingReset:
    def test_delete_resets_defaults(self, new_tenant_session):
        # Set something first
        new_tenant_session.put(f"{API}/settings/branding", json={
            "app_name": "Something", "short_name": "Sthg", "theme_color": "#abcdef"
        })
        r = new_tenant_session.delete(f"{API}/settings/branding")
        assert r.status_code == 200
        g = new_tenant_session.get(f"{API}/settings/branding").json()
        assert g["app_name"] == "KasirPintar AI"
        assert g["short_name"] == "KasirPintar"
        assert g["theme_color"] == "#e85d04"


class TestTenantIsolation:
    def test_isolation_admin_vs_new_tenant(self, admin_session, new_tenant_session):
        # New tenant sets a unique brand
        unique = f"Toko{uuid.uuid4().hex[:6]}"
        new_tenant_session.put(f"{API}/settings/branding", json={
            "app_name": f"App {unique}",
            "short_name": unique[:12],
            "theme_color": "#112233",
        })
        # Admin sets different brand
        admin_session.put(f"{API}/settings/branding", json={
            "app_name": "Admin Brand",
            "short_name": "AdminBr",
            "theme_color": "#445566",
        })
        # New tenant reads: should still be its own
        nt = new_tenant_session.get(f"{API}/settings/branding").json()
        assert nt["short_name"] == unique[:12]
        assert nt["theme_color"] == "#112233"
        # Admin reads its own
        ad = admin_session.get(f"{API}/settings/branding").json()
        assert ad["short_name"] == "AdminBr"
        assert ad["theme_color"] == "#445566"
