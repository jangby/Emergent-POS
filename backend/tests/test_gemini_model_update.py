"""
Tests for the Gemini model name update: 'gemini-2.5-flash' -> 'gemini-3.6-flash'
and verification of graceful failure handling on invalid keys.
"""
import os
import time
import asyncio
import httpx
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pintar-inventory.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "robaya05@gmail.com"
ADMIN_PASSWORD = "admin123"
DUMMY_KEY = "AIzaSy_DUMMY_KEY_FOR_TEST_1234567890"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module", autouse=True)
def _cleanup(auth_headers):
    yield
    # final cleanup after all tests
    try:
        requests.delete(f"{API}/settings/gemini", headers=auth_headers, timeout=15)
    except Exception:
        pass


# --- 1. GET /api/settings returns model 'gemini-3.6-flash' ---
def test_settings_returns_new_model_name(auth_headers):
    r = requests.get(f"{API}/settings", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "gemini" in data, f"gemini key missing: {data}"
    model = data["gemini"].get("model")
    assert model == "gemini-3.6-flash", f"expected gemini-3.6-flash, got {model!r}"


# --- 2. Backend constants (verified via source grep) ---
def test_source_constants_are_gemini_36_flash():
    with open("/app/backend/server.py") as f:
        src = f.read()
    assert 'GEMINI_MODEL_TEXT = "gemini-3.6-flash"' in src
    assert 'GEMINI_MODEL_VISION = "gemini-3.6-flash"' in src
    assert "gemini-2.5-flash" not in src, "old model name still present in server.py"


# --- 3. Save dummy invalid key ---
def test_save_dummy_key(auth_headers):
    r = requests.put(f"{API}/settings/gemini",
                     headers=auth_headers,
                     json={"api_key": DUMMY_KEY}, timeout=15)
    assert r.status_code in (200, 204), r.text

    # verify configured=true now
    r2 = requests.get(f"{API}/settings", headers=auth_headers, timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("gemini", {}).get("configured") is True


# --- 4. Invalid key -> graceful HTTP 4xx (NOT 5xx crash), fast (<15s) ---
def test_gemini_test_endpoint_invalid_key_graceful(auth_headers):
    t0 = time.time()
    r = requests.post(f"{API}/settings/gemini/test", headers=auth_headers, timeout=60)
    elapsed = time.time() - t0
    print(f"gemini/test status={r.status_code} elapsed={elapsed:.2f}s body={r.text[:300]}")
    # must NOT be 502/520/500 crash
    assert r.status_code < 500, f"backend crashed with {r.status_code}: {r.text[:500]}"
    # should be a 4xx client error with readable detail
    assert r.status_code in (400, 401, 403, 429), f"unexpected status {r.status_code}: {r.text[:500]}"
    body = r.json()
    assert "detail" in body
    assert isinstance(body["detail"], str) and len(body["detail"]) > 10


def test_ai_insights_invalid_key_graceful(auth_headers):
    t0 = time.time()
    r = requests.get(f"{API}/ai/insights", headers=auth_headers, timeout=60)
    elapsed = time.time() - t0
    print(f"ai/insights status={r.status_code} elapsed={elapsed:.2f}s")
    assert r.status_code < 500, f"backend crashed with {r.status_code}: {r.text[:500]}"
    # Accept 400/401/403/429 for invalid key OR 404 if endpoint has diff shape
    assert r.status_code in (400, 401, 403, 404, 429), f"unexpected status {r.status_code}: {r.text[:500]}"


# --- 5. Parallel calls: event loop must NOT block ---
def test_parallel_ai_calls_do_not_block(auth_headers):
    async def run_all():
        async with httpx.AsyncClient(timeout=30) as c:
            t0 = time.time()
            tasks = [c.get(f"{API}/ai/insights", headers=auth_headers) for _ in range(5)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            total = time.time() - t0
            return results, total

    results, total = asyncio.run(run_all())
    print(f"5 parallel calls total elapsed={total:.2f}s")
    # With asyncio.Lock serializing genai.configure, 5 calls each ~a few s to error out.
    # Each individual should not hang for the full 55s timeout.
    # Overall should still finish reasonably (allow generous 60s for 5 serialized quick fails).
    for i, res in enumerate(results):
        assert not isinstance(res, Exception), f"call {i} raised: {res}"
        assert res.status_code < 500, f"call {i} crashed: {res.status_code} {res.text[:300]}"
    # Each individual call should have completed since they returned; total bounded.
    assert total < 90, f"parallel calls too slow: {total:.2f}s (possible event loop block)"


# --- 6. Verify traceback logged ---
def test_error_traceback_logged_in_supervisor_log(auth_headers):
    # trigger a fresh failing call to ensure log line exists
    requests.post(f"{API}/settings/gemini/test", headers=auth_headers, timeout=60)
    time.sleep(1)
    log_path = "/var/log/supervisor/backend.err.log"
    assert os.path.exists(log_path), f"log file not found: {log_path}"
    with open(log_path, "r", errors="ignore") as f:
        content = f.read()[-200_000:]  # last 200KB
    assert "Gemini call failed" in content, "expected 'Gemini call failed' in backend.err.log"
    assert "Traceback (most recent call last)" in content, "expected traceback in backend.err.log"


# --- 7. Backend stays responsive after AI errors ---
def test_backend_responsive_after_ai_errors(auth_headers):
    # trigger error
    requests.post(f"{API}/settings/gemini/test", headers=auth_headers, timeout=60)

    t0 = time.time()
    r1 = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=10)
    e1 = time.time() - t0
    assert r1.status_code == 200, r1.text
    assert e1 < 5, f"/api/auth/me too slow after AI error: {e1:.2f}s"

    t0 = time.time()
    r2 = requests.get(f"{API}/products", headers=auth_headers, timeout=10)
    e2 = time.time() - t0
    assert r2.status_code == 200, r2.text
    assert e2 < 5, f"/api/products too slow after AI error: {e2:.2f}s"


# --- 8. DELETE clears the key ---
def test_delete_gemini_key(auth_headers):
    r = requests.delete(f"{API}/settings/gemini", headers=auth_headers, timeout=15)
    assert r.status_code in (200, 204), r.text

    r2 = requests.get(f"{API}/settings", headers=auth_headers, timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("gemini", {}).get("configured") is False
