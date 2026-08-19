# KasirPintar AI - PRD

Mobile-first Web POS + Inventory app for Indonesian UMKM.

## Core features (Delivered)
- JWT auth (login/register); admin seeded as robaya05@gmail.com
- **Multi-Tenant architecture (2026-02)**: every registered user is owner of their own isolated tenant; cashiers inherit tenant from owner. All CRUD/analytics/settings filtered by `tenant_id`. Frontend clears IndexedDB + localStorage on login/logout to prevent leakage.
- **BYOK Gemini AI (2026-02)**: each tenant stores their own Google Gemini API key (encrypted). All AI features (Restock OCR, business insights, WA order parser, bundle suggestions, WA bot) call the **official `google-generativeai` SDK** with the tenant's key. Model: `gemini-2.5-flash`. Endpoints: `GET/PUT/DELETE /api/settings/gemini` + `POST /api/settings/gemini/test`. Clear 400 error when key missing or invalid.
- **Gemini reliability hardening (2026-02)**: `gemini_generate()` uses `fastapi.concurrency.run_in_threadpool` (never blocks event loop), `asyncio.Lock` (protects `genai.configure` global state under concurrency), SDK `request_options.timeout=45s` + outer `asyncio.wait_for(55s)` (prevents Cloudflare 502/520), `_extract_text_safely()` (safe against blocked-response `resp.text` crashes), and granular error mapping (401→400, quota→429, timeout→504, safety→400). Full traceback logged via `logging.error(..., exc_info=True)`.
- POS: product grid, category filter, cart, cash + QRIS + credit payment, receipt
- Web Bluetooth ESC/POS thermal printer + PDF fallback
- Physical hardware barcode scanner (global keydown listener)
- Printable barcode labels (`react-barcode`)
- Inventory CRUD + low stock WA alerts + Excel import/export
- Transactions history + re-print
- Analytics dashboard (revenue/profit charts, top products, cashier leaderboard)
- Shifts (open/close, cash reconciliation)
- Promotions engine (percentage / fixed / BxGy / min-purchase)
- Debt / customer credit ledger + WA reminders
- Expense tracker + Net Profit computation
- AI Vision OCR receipt scanner (per-tenant Gemini key)
- AI Business Insights & AI Bundle Suggestions (per-tenant Gemini key)
- AI WhatsApp order parser + fully automated WA bot (per-tenant webhook + per-tenant Gemini key)
- Midtrans QRIS integration (per-tenant credentials, webhook resolves tenant via order_id)
- Fonnte WhatsApp (per-tenant token)
- Offline-first PWA (IndexedDB queue, service worker, background sync, install prompt)
- Dark/light theme toggle
- Sample Indonesian retail products pre-seeded (admin tenant only)

## Multi-Tenancy & BYOK notes
- `tenant_id` = owner's `user.id`. Cashiers inherit from owner.
- `tenant_of(user)` helper is applied to every DB query/insert.
- Gemini API key stored under `settings.gemini.api_key_enc` (Fernet-encrypted). Never returned to frontend — only `configured: true/false` is exposed.
- Legacy pre-multi-tenant docs backfilled to admin tenant on startup.

## Backlog (P1)
- Dynamic White-Labeling & Custom PWA Branding (per-tenant App name, short_name, logo, theme color, live preview, dynamic manifest blob)
- Blast Promo WA (send AI-bundled promos to past buyers)
- Debt aging alert (>14 days outstanding)

## Backlog (P2)
- Monthly top-cashier auto-award + printable certificate
- Cashier role restriction (limit access to POS-only, hide analytics/settings)

## Refactor / Tech debt
- `/app/backend/server.py` ~2020 lines — split into routers (auth, products, tx, analytics, settings, wa, midtrans, ai, exports)
- `EMERGENT_LLM_KEY` env var + import are now unused since BYOK migration → safe to remove in a cleanup pass
