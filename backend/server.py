from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import base64
import hashlib
import hmac
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import httpx
from cryptography.fernet import Fernet
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# --- Config ---
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALGO = 'HS256'
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
SETTINGS_ENCRYPTION_KEY = os.environ.get('SETTINGS_ENCRYPTION_KEY', '').encode()

fernet = Fernet(SETTINGS_ENCRYPTION_KEY) if SETTINGS_ENCRYPTION_KEY else None

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="KasirPintar AI")
api = APIRouter(prefix="/api")

# --- Utils ---
def now_utc():
    return datetime.now(timezone.utc)

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_access_token(uid: str, email: str) -> str:
    return jwt.encode({"sub": uid, "email": email, "type": "access",
                       "exp": now_utc() + timedelta(hours=8)}, JWT_SECRET, algorithm=JWT_ALGO)

def create_refresh_token(uid: str) -> str:
    return jwt.encode({"sub": uid, "type": "refresh",
                       "exp": now_utc() + timedelta(days=30)}, JWT_SECRET, algorithm=JWT_ALGO)

def set_auth_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                    max_age=28800, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                    max_age=2592000, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def enc(v: str) -> str:
    return fernet.encrypt(v.encode()).decode() if fernet and v else v

def dec(v: str) -> str:
    if not fernet or not v:
        return v
    try:
        return fernet.decrypt(v.encode()).decode()
    except Exception:
        return ""

def strip_id(d: dict) -> dict:
    if d and "_id" in d:
        d.pop("_id", None)
    return d

# --- Auth models ---
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = "Merchant"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

# --- Auth routes ---
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    user = {"id": uid, "email": email, "name": body.name, "role": "owner",
            "password_hash": hash_password(body.password),
            "created_at": now_utc().isoformat()}
    await db.users.insert_one(user)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"id": uid, "email": email, "name": body.name, "role": "owner",
            "access_token": access}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": email, "name": user["name"], "role": user.get("role", "owner"),
            "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/refresh")
async def refresh_token_ep(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(rt, JWT_SECRET, algorithms=[JWT_ALGO])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(401, "User not found")
        access = create_access_token(user["id"], user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True,
                            samesite="none", max_age=28800, path="/")
        return {"access_token": access}
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

# --- Product models ---
class ProductIn(BaseModel):
    name: str
    category: str
    stock: int = 0
    buy_price: int = 0
    sell_price: int = 0
    sku: Optional[str] = None
    image_url: Optional[str] = None

# --- Products ---
@api.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    items = await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return items

@api.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(get_current_user)):
    pid = str(uuid.uuid4())
    doc = {"id": pid, **body.model_dump(), "created_at": now_utc().isoformat()}
    await db.products.insert_one(doc)
    return strip_id(doc)

@api.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn, user: dict = Depends(get_current_user)):
    r = await db.products.update_one({"id": pid}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    return doc

@api.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(get_current_user)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}

@api.get("/products/categories")
async def categories(user: dict = Depends(get_current_user)):
    cats = await db.products.distinct("category")
    return sorted(cats)

# --- Transactions ---
class CartItem(BaseModel):
    product_id: str
    name: str
    qty: int
    price: int  # sell price at time
    buy_price: int = 0
    discount: int = 0  # per line in Rp

class TransactionIn(BaseModel):
    items: List[CartItem]
    subtotal: int
    discount: int = 0
    tax: int = 0
    total: int
    payment_method: Literal["cash", "qris"]
    cash_tendered: int = 0
    change: int = 0
    qris_order_id: Optional[str] = None
    qris_status: Optional[str] = None

@api.post("/transactions")
async def create_transaction(body: TransactionIn, user: dict = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    order_id = f"TRX-{datetime.now().strftime('%y%m%d%H%M%S')}-{tid[:4].upper()}"
    net_profit = 0
    for it in body.items:
        net_profit += (it.price - it.buy_price) * it.qty - it.discount
    doc = {"id": tid, "order_id": order_id,
           "items": [i.model_dump() for i in body.items],
           "subtotal": body.subtotal, "discount": body.discount,
           "tax": body.tax, "total": body.total,
           "payment_method": body.payment_method,
           "cash_tendered": body.cash_tendered, "change": body.change,
           "qris_order_id": body.qris_order_id, "qris_status": body.qris_status,
           "status": "completed" if body.payment_method == "cash" or body.qris_status in ("settlement", "capture") else "pending",
           "net_profit": net_profit,
           "cashier": user["email"],
           "created_at": now_utc().isoformat()}
    await db.transactions.insert_one(doc)

    # Deduct stock
    for it in body.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.qty}})

    return strip_id(doc)

@api.get("/transactions")
async def list_transactions(q: Optional[str] = None, days: int = 30,
                            user: dict = Depends(get_current_user)):
    cutoff = (now_utc() - timedelta(days=days)).isoformat()
    query = {"created_at": {"$gte": cutoff}}
    if q:
        query["order_id"] = {"$regex": q, "$options": "i"}
    items = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.get("/transactions/{tid}")
async def get_transaction(tid: str, user: dict = Depends(get_current_user)):
    doc = await db.transactions.find_one({"id": tid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc

# --- Analytics ---
@api.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(get_current_user)):
    all_tx = await db.transactions.find({"status": "completed"}, {"_id": 0}).to_list(5000)
    today = now_utc().date()
    week_ago = today - timedelta(days=6)
    month_ago = today - timedelta(days=29)

    def tx_date(t):
        return datetime.fromisoformat(t["created_at"]).date()

    total_today = sum(t["total"] for t in all_tx if tx_date(t) == today)
    total_week = sum(t["total"] for t in all_tx if tx_date(t) >= week_ago)
    total_month = sum(t["total"] for t in all_tx if tx_date(t) >= month_ago)
    profit_month = sum(t.get("net_profit", 0) for t in all_tx if tx_date(t) >= month_ago)

    # Daily revenue vs profit (last 30 days)
    daily = {}
    for i in range(30):
        d = today - timedelta(days=29 - i)
        daily[d.isoformat()] = {"date": d.isoformat(), "revenue": 0, "profit": 0}
    for t in all_tx:
        d = tx_date(t).isoformat()
        if d in daily:
            daily[d]["revenue"] += t["total"]
            daily[d]["profit"] += t.get("net_profit", 0)
    daily_series = list(daily.values())

    # Top products
    top = {}
    for t in all_tx:
        for it in t["items"]:
            top.setdefault(it["name"], {"name": it["name"], "qty": 0, "revenue": 0})
            top[it["name"]]["qty"] += it["qty"]
            top[it["name"]]["revenue"] += it["price"] * it["qty"]
    top_list = sorted(top.values(), key=lambda x: x["qty"], reverse=True)[:5]

    return {
        "today_revenue": total_today,
        "week_revenue": total_week,
        "month_revenue": total_month,
        "month_profit": profit_month,
        "tx_count": len(all_tx),
        "daily_series": daily_series,
        "top_products": top_list,
    }

# --- AI: Vision OCR for wholesale receipt ---
@api.post("/ai/scan-receipt")
async def scan_receipt(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        content = await file.read()
        b64 = base64.b64encode(content).decode()
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr-{uuid.uuid4()}",
            system_message=(
                "You are an OCR AI for Indonesian wholesale receipts (Nota Belanja Grosir). "
                "Extract each product line item and return ONLY valid JSON: "
                '{"items":[{"name":"...","qty":<int>,"buy_price":<int rupiah per unit, no decimals>}]}. '
                "Do not include markdown or explanation."
            )
        ).with_model("gemini", "gemini-3-flash-preview")

        msg = UserMessage(text="Extract items from this receipt image.",
                          file_contents=[ImageContent(image_base64=b64)])
        result = await chat.send_message(msg)
        text = result if isinstance(result, str) else str(result)
        # Strip code fences if present
        import re, json
        text = re.sub(r"^```(json)?", "", text.strip()).rstrip("`").strip()
        m = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(m.group(0)) if m else {"items": []}
        return parsed
    except Exception as e:
        logging.exception("OCR failed")
        raise HTTPException(500, f"AI OCR gagal: {str(e)}")

class RestockItem(BaseModel):
    product_id: Optional[str] = None
    name: str
    qty: int
    buy_price: int
    category: str = "Umum"

class RestockIn(BaseModel):
    items: List[RestockItem]

@api.post("/ai/confirm-restock")
async def confirm_restock(body: RestockIn, user: dict = Depends(get_current_user)):
    updated = 0
    created = 0
    for it in body.items:
        existing = None
        if it.product_id:
            existing = await db.products.find_one({"id": it.product_id})
        if not existing:
            existing = await db.products.find_one({"name": {"$regex": f"^{it.name}$", "$options": "i"}})
        if existing:
            await db.products.update_one({"id": existing["id"]},
                                         {"$inc": {"stock": it.qty},
                                          "$set": {"buy_price": it.buy_price}})
            updated += 1
        else:
            pid = str(uuid.uuid4())
            await db.products.insert_one({
                "id": pid, "name": it.name, "category": it.category,
                "stock": it.qty, "buy_price": it.buy_price,
                "sell_price": int(it.buy_price * 1.2),
                "sku": "", "image_url": "",
                "created_at": now_utc().isoformat()
            })
            created += 1
    return {"updated": updated, "created": created}

# --- Barcode lookup ---
@api.get("/products/by-sku/{sku}")
async def product_by_sku(sku: str, user: dict = Depends(get_current_user)):
    doc = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Produk tidak ditemukan")
    return doc

# --- WhatsApp / Fonnte ---
class FonnteSettingsIn(BaseModel):
    token: str = Field(min_length=5)

class WASendIn(BaseModel):
    target: str = Field(min_length=5)  # e.g. 628xxx
    message: str = Field(min_length=1)

class WASendReceiptIn(BaseModel):
    target: str = Field(min_length=5)
    transaction_id: str

async def get_fonnte_token() -> str:
    doc = await db.settings.find_one({"id": "default"}) or {}
    tk_enc = doc.get("fonnte", {}).get("token_enc")
    if not tk_enc:
        raise HTTPException(400, "Fonnte belum dikonfigurasi di Pengaturan.")
    return dec(tk_enc)

def normalize_wa_target(t: str) -> str:
    t = t.strip().replace("+", "").replace("-", "").replace(" ", "")
    if t.startswith("0"):
        t = "62" + t[1:]
    return t

@api.put("/settings/fonnte")
async def save_fonnte(body: FonnteSettingsIn, user: dict = Depends(get_current_user)):
    await db.settings.update_one({"id": "default"},
                                 {"$set": {"id": "default", "fonnte": {
                                     "token_enc": enc(body.token),
                                     "updated_at": now_utc().isoformat(),
                                 }}}, upsert=True)
    return {"ok": True}

@api.post("/whatsapp/send")
async def wa_send(body: WASendIn, user: dict = Depends(get_current_user)):
    token = await get_fonnte_token()
    target = normalize_wa_target(body.target)
    try:
        async with httpx.AsyncClient(timeout=20) as hc:
            r = await hc.post("https://api.fonnte.com/send",
                              headers={"Authorization": token},
                              data={"target": target, "message": body.message,
                                    "countryCode": "62"})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    except Exception as e:
        raise HTTPException(502, f"Gagal terhubung ke Fonnte: {str(e)}")
    if not data.get("status"):
        raise HTTPException(400, data.get("reason") or "Gagal mengirim WhatsApp")
    return {"ok": True, "detail": data.get("detail"), "requestid": data.get("requestid")}

def format_receipt_wa(store: dict, tx: dict) -> str:
    def fmt(n): return "Rp" + f"{int(n or 0):,}".replace(",", ".")
    lines = []
    lines.append(f"*{store.get('name', 'Toko')}*")
    if store.get("address"): lines.append(store["address"])
    if store.get("phone"): lines.append(store["phone"])
    lines.append("--------------------------------")
    lines.append(f"No : {tx['order_id']}")
    lines.append(f"Tgl: {datetime.fromisoformat(tx['created_at']).strftime('%d/%m/%Y %H:%M')}")
    lines.append("--------------------------------")
    for it in tx["items"]:
        lines.append(f"{it['name']}")
        lines.append(f"  {it['qty']} x {fmt(it['price'])} = {fmt(it['qty'] * it['price'])}")
    lines.append("--------------------------------")
    lines.append(f"Subtotal : {fmt(tx['subtotal'])}")
    if tx.get("discount"): lines.append(f"Diskon   : -{fmt(tx['discount'])}")
    if tx.get("tax"):      lines.append(f"Pajak    : {fmt(tx['tax'])}")
    lines.append(f"*TOTAL    : {fmt(tx['total'])}*")
    lines.append(f"Bayar ({tx.get('payment_method', '').upper()}): {fmt(tx.get('cash_tendered') or tx['total'])}")
    if tx.get("change"): lines.append(f"Kembalian: {fmt(tx['change'])}")
    lines.append("--------------------------------")
    lines.append(store.get("footer", "Terima Kasih!"))
    return "\n".join(lines)

@api.post("/whatsapp/send-receipt")
async def wa_send_receipt(body: WASendReceiptIn, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": body.transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    st = await db.settings.find_one({"id": "default"}) or {}
    store = st.get("store", {})
    msg = format_receipt_wa(store, tx)
    return await wa_send(WASendIn(target=body.target, message=msg), user)

# --- AI Order Parser (parses free-text WA message into cart items) ---
class OrderParseIn(BaseModel):
    text: str = Field(min_length=1)

@api.post("/ai/parse-order")
async def parse_order(body: OrderParseIn, user: dict = Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        products = await db.products.find({}, {"_id": 0}).to_list(500)
        catalog = "\n".join([f"- {p['name']} (id={p['id']}, harga={p['sell_price']}, stok={p['stock']})" for p in products])

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"order-{uuid.uuid4()}",
            system_message=(
                "Kamu adalah AI yang memahami pesan pemesanan WhatsApp dari pelanggan toko UMKM Indonesia. "
                "Diberikan katalog produk dan pesan bebas dari pelanggan, cocokkan item yang dipesan "
                "berdasarkan nama yang mirip (misal 'indomie' cocok dengan 'Indomie Goreng'). "
                "Balas ONLY JSON valid dalam format: "
                '{"items":[{"product_id":"...","name":"...","qty":<int>}], "unmatched":["..."]}. '
                "unmatched berisi item yang tidak ditemukan di katalog. "
                "Jangan gunakan markdown."
            )
        ).with_model("gemini", "gemini-3-flash-preview")

        prompt = f"KATALOG:\n{catalog}\n\nPESAN PELANGGAN:\n{body.text}"
        result = await chat.send_message(UserMessage(text=prompt))
        text = result if isinstance(result, str) else str(result)
        import re, json
        text = re.sub(r"^```(json)?", "", text.strip()).rstrip("`").strip()
        m = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(m.group(0)) if m else {"items": [], "unmatched": []}

        # Enrich with current price & stock
        by_id = {p["id"]: p for p in products}
        enriched = []
        for it in parsed.get("items", []):
            pr = by_id.get(it.get("product_id"))
            if pr:
                enriched.append({
                    "product_id": pr["id"], "name": pr["name"],
                    "qty": int(it.get("qty", 1)),
                    "price": pr["sell_price"], "buy_price": pr["buy_price"],
                    "stock": pr["stock"],
                })
        return {"items": enriched, "unmatched": parsed.get("unmatched", [])}
    except Exception as e:
        logging.exception("Order parse failed")
        raise HTTPException(500, f"AI gagal memahami pesan: {str(e)}")


# --- AI Business Insights ---
@api.get("/ai/insights")
async def ai_insights(user: dict = Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        summary = await analytics_summary(user)
        products = await db.products.find({}, {"_id": 0}).to_list(500)
        low_stock = [p["name"] for p in products if p["stock"] <= 5]
        top_names = ", ".join([f"{p['name']} ({p['qty']} terjual)" for p in summary["top_products"][:3]]) or "belum ada data"

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"insight-{uuid.uuid4()}",
            system_message=(
                "Kamu adalah asisten AI bisnis untuk pemilik toko UMKM Indonesia. "
                "Berikan 3-4 kalimat singkat, ramah, dalam Bahasa Indonesia. "
                "Fokus pada: produk terlaris, peringatan stok menipis, dan saran singkat. "
                "Jangan pakai markdown atau bullet. Tulis sebagai paragraf natural."
            )
        ).with_model("gemini", "gemini-3-flash-preview")

        prompt = (
            f"Pendapatan hari ini: Rp{summary['today_revenue']:,}. "
            f"Pendapatan 30 hari: Rp{summary['month_revenue']:,}. "
            f"Laba bersih 30 hari: Rp{summary['month_profit']:,}. "
            f"Total transaksi: {summary['tx_count']}. "
            f"Produk terlaris: {top_names}. "
            f"Stok menipis: {', '.join(low_stock[:5]) or 'tidak ada'}."
        )
        result = await chat.send_message(UserMessage(text=prompt))
        text = result if isinstance(result, str) else str(result)
        return {"insight": text.strip()}
    except Exception as e:
        logging.exception("Insight failed")
        return {"insight": f"Ringkasan AI tidak tersedia saat ini. ({str(e)})"}

# --- Settings (Store + Midtrans) ---
class StoreProfile(BaseModel):
    name: str = "Toko Saya"
    address: str = ""
    phone: str = ""
    footer: str = "Terima Kasih atas Kunjungan Anda!"

class MidtransSettingsIn(BaseModel):
    mode: Literal["sandbox", "production"] = "sandbox"
    merchant_id: str = ""
    client_key: str = ""
    server_key: str = ""

@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {}
    store = doc.get("store", StoreProfile().model_dump())
    mt = doc.get("midtrans", {})
    fn = doc.get("fonnte", {})
    return {
        "store": store,
        "midtrans": {
            "mode": mt.get("mode", "sandbox"),
            "merchant_id": dec(mt.get("merchant_id_enc", "")),
            "client_key": dec(mt.get("client_key_enc", "")),
            "server_key_masked": ("*" * 8 + dec(mt.get("server_key_enc", ""))[-4:]) if mt.get("server_key_enc") else "",
            "configured": bool(mt.get("server_key_enc")),
        },
        "fonnte": {
            "configured": bool(fn.get("token_enc")),
        },
    }

@api.put("/settings/store")
async def save_store(body: StoreProfile, user: dict = Depends(get_current_user)):
    await db.settings.update_one({"id": "default"},
                                 {"$set": {"id": "default", "store": body.model_dump()}},
                                 upsert=True)
    return body

@api.put("/settings/midtrans")
async def save_midtrans(body: MidtransSettingsIn, user: dict = Depends(get_current_user)):
    await db.settings.update_one({"id": "default"},
                                 {"$set": {"id": "default", "midtrans": {
                                     "mode": body.mode,
                                     "merchant_id_enc": enc(body.merchant_id),
                                     "client_key_enc": enc(body.client_key),
                                     "server_key_enc": enc(body.server_key),
                                     "updated_at": now_utc().isoformat(),
                                 }}}, upsert=True)
    return {"ok": True}

async def get_midtrans_creds():
    doc = await db.settings.find_one({"id": "default"}) or {}
    mt = doc.get("midtrans", {})
    if not mt.get("server_key_enc"):
        raise HTTPException(400, "Midtrans belum dikonfigurasi. Silakan atur di Pengaturan.")
    return {"mode": mt.get("mode", "sandbox"),
            "server_key": dec(mt["server_key_enc"]),
            "client_key": dec(mt.get("client_key_enc", "")),
            "merchant_id": dec(mt.get("merchant_id_enc", ""))}

def midtrans_base(mode: str) -> str:
    return "https://api.sandbox.midtrans.com" if mode == "sandbox" else "https://api.midtrans.com"

# --- Midtrans QRIS ---
class QRISCreateIn(BaseModel):
    order_id: str
    amount: int = Field(gt=0)

@api.post("/payments/qris")
async def create_qris(body: QRISCreateIn, user: dict = Depends(get_current_user)):
    creds = await get_midtrans_creds()
    payload = {
        "payment_type": "qris",
        "transaction_details": {"order_id": body.order_id, "gross_amount": body.amount},
        "qris": {"acquirer": "gopay"}
    }
    async with httpx.AsyncClient(timeout=20) as hc:
        r = await hc.post(f"{midtrans_base(creds['mode'])}/v2/charge",
                          json=payload, auth=(creds['server_key'], ""),
                          headers={"Accept": "application/json"})
    data = r.json()
    if r.status_code >= 400:
        raise HTTPException(r.status_code, detail=data)
    action = None
    for a in data.get("actions", []):
        if a.get("name") == "generate-qr-code-v2":
            action = a
            break
    if not action:
        for a in data.get("actions", []):
            if a.get("name") == "generate-qr-code":
                action = a
                break
    await db.qris_payments.insert_one({
        "order_id": body.order_id, "amount": body.amount,
        "transaction_id": data.get("transaction_id"),
        "status": data.get("transaction_status", "pending"),
        "qr_url": action.get("url") if action else None,
        "created_at": now_utc().isoformat()
    })
    return {"order_id": body.order_id, "status": data.get("transaction_status"),
            "qr_url": action.get("url") if action else None,
            "transaction_id": data.get("transaction_id")}

@api.get("/payments/qris/{order_id}/status")
async def qris_status(order_id: str, user: dict = Depends(get_current_user)):
    creds = await get_midtrans_creds()
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(f"{midtrans_base(creds['mode'])}/v2/{order_id}/status",
                         auth=(creds['server_key'], ""),
                         headers={"Accept": "application/json"})
    if r.status_code >= 400:
        raise HTTPException(r.status_code, detail=r.json())
    data = r.json()
    status = data.get("transaction_status")
    await db.qris_payments.update_one({"order_id": order_id},
                                      {"$set": {"status": status,
                                                "updated_at": now_utc().isoformat()}})
    return {"order_id": order_id, "status": status,
            "fraud_status": data.get("fraud_status")}

@api.post("/payments/midtrans/webhook")
async def midtrans_webhook(request: Request):
    payload = await request.json()
    order_id = str(payload.get("order_id", ""))
    status_code = str(payload.get("status_code", ""))
    gross_amount = str(payload.get("gross_amount", ""))
    supplied = str(payload.get("signature_key", ""))
    if not order_id or not supplied:
        raise HTTPException(400, "invalid notification")
    creds = await get_midtrans_creds()
    expected = hashlib.sha512(f"{order_id}{status_code}{gross_amount}{creds['server_key']}".encode()).hexdigest()
    if not hmac.compare_digest(expected, supplied):
        raise HTTPException(403, "invalid signature")
    await db.qris_payments.update_one({"order_id": order_id},
                                      {"$set": {"status": payload.get("transaction_status"),
                                                "last_webhook": payload,
                                                "updated_at": now_utc().isoformat()}},
                                      upsert=True)
    return {"ok": True}

# --- Seed ---
SEED_PRODUCTS = [
    {"name": "Indomie Goreng", "category": "Mie Instan", "stock": 48, "buy_price": 2800, "sell_price": 3500, "sku": "IDM-GRG-001",
     "image_url": "https://images.unsplash.com/photo-1612927601601-6638404737ce?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Minyak Goreng Sania 1L", "category": "Sembako", "stock": 3, "buy_price": 15500, "sell_price": 18000, "sku": "SNA-MG-1L",
     "image_url": "https://images.unsplash.com/photo-1666694890460-37ec16b0df47?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Kopi Kapal Api Sachet", "category": "Minuman", "stock": 82, "buy_price": 1200, "sell_price": 1500, "sku": "KAP-SCH",
     "image_url": "https://images.unsplash.com/photo-1511920170033-f8396924c348?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Teh Botol Sosro 350ml", "category": "Minuman", "stock": 24, "buy_price": 3500, "sell_price": 4500, "sku": "TBS-350",
     "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Beras Ramos 5kg", "category": "Sembako", "stock": 12, "buy_price": 62000, "sell_price": 72000, "sku": "BRS-5KG",
     "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Gula Pasir Gulaku 1kg", "category": "Sembako", "stock": 18, "buy_price": 14000, "sell_price": 16500, "sku": "GLK-1KG",
     "image_url": "https://images.unsplash.com/photo-1519414442781-fbd745c5b497?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Aqua 600ml", "category": "Minuman", "stock": 60, "buy_price": 2500, "sell_price": 3500, "sku": "AQU-600",
     "image_url": "https://images.unsplash.com/photo-1550505095-81378a674395?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Silverqueen Chunky 65g", "category": "Snack", "stock": 15, "buy_price": 13000, "sell_price": 16000, "sku": "SLQ-65",
     "image_url": "https://images.unsplash.com/photo-1548907040-4baa42d10919?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Chitato Sapi Panggang", "category": "Snack", "stock": 22, "buy_price": 7500, "sell_price": 9500, "sku": "CHT-SAPI",
     "image_url": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Roti Tawar Sari Roti", "category": "Roti", "stock": 5, "buy_price": 15000, "sell_price": 18500, "sku": "SR-TAWAR",
     "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Susu Ultra Coklat 250ml", "category": "Minuman", "stock": 30, "buy_price": 5500, "sell_price": 7000, "sku": "ULT-CKL",
     "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
    {"name": "Sabun Lifebuoy 85g", "category": "Rumah Tangga", "stock": 40, "buy_price": 3500, "sell_price": 4500, "sku": "LB-85",
     "image_url": "https://images.unsplash.com/photo-1585232004423-244e0e6904e3?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"},
]

async def seed_data():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("name")
    await db.transactions.create_index("created_at")

    # admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": ADMIN_EMAIL.lower(),
            "name": "Owner", "role": "owner",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": now_utc().isoformat(),
        })
        logging.info(f"Seeded admin {ADMIN_EMAIL}")
    else:
        # Update password to match .env
        if not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
            await db.users.update_one({"email": ADMIN_EMAIL.lower()},
                                      {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # products
    if await db.products.count_documents({}) == 0:
        for p in SEED_PRODUCTS:
            await db.products.insert_one({"id": str(uuid.uuid4()), **p,
                                          "created_at": now_utc().isoformat()})
        logging.info("Seeded sample products")

    # settings default
    if not await db.settings.find_one({"id": "default"}):
        await db.settings.insert_one({"id": "default",
                                      "store": StoreProfile(name="KasirPintar Demo",
                                                            address="Jl. Sudirman No. 1, Jakarta",
                                                            phone="0812-3456-7890").model_dump(),
                                      "midtrans": {}})

    # dummy transactions if empty
    if await db.transactions.count_documents({}) == 0:
        products = await db.products.find({}, {"_id": 0}).to_list(20)
        import random
        for day_offset in range(28, -1, -1):
            date = now_utc() - timedelta(days=day_offset)
            num_tx = random.randint(2, 6)
            for _ in range(num_tx):
                num_items = random.randint(1, 3)
                items = []
                subtotal = 0
                profit = 0
                for _ in range(num_items):
                    pr = random.choice(products)
                    qty = random.randint(1, 3)
                    items.append({"product_id": pr["id"], "name": pr["name"],
                                  "qty": qty, "price": pr["sell_price"],
                                  "buy_price": pr["buy_price"], "discount": 0})
                    subtotal += pr["sell_price"] * qty
                    profit += (pr["sell_price"] - pr["buy_price"]) * qty
                tid = str(uuid.uuid4())
                await db.transactions.insert_one({
                    "id": tid,
                    "order_id": f"TRX-{date.strftime('%y%m%d%H%M%S')}-{tid[:4].upper()}",
                    "items": items, "subtotal": subtotal, "discount": 0, "tax": 0,
                    "total": subtotal, "payment_method": random.choice(["cash", "qris"]),
                    "cash_tendered": subtotal, "change": 0,
                    "status": "completed", "net_profit": profit,
                    "cashier": ADMIN_EMAIL,
                    "created_at": date.isoformat(),
                })
        logging.info("Seeded dummy transactions")

@app.on_event("startup")
async def startup():
    await seed_data()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown():
    client.close()
