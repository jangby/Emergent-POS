# KasirPintar AI - PRD

Mobile-first Web POS + Inventory app for Indonesian UMKM.

## Core features (Delivered)
- JWT auth (login/register); admin seeded as robaya05@gmail.com
- **Multi-Tenant architecture (2026-02)**: every registered user is owner of their own isolated tenant; cashiers inherit tenant from owner. All CRUD/analytics/settings filtered by `tenant_id`. Frontend clears IndexedDB + localStorage on login/logout to prevent leakage.
- **BYOK Gemini AI (2026-02)**: each tenant stores their own Google Gemini API key (encrypted). All AI features (Restock OCR, business insights, WA order parser, bundle suggestions, WA bot) call the **official `google-generativeai` SDK** with the tenant's key. Model: `gemini-3.6-flash`. Endpoints: `GET/PUT/DELETE /api/settings/gemini` + `POST /api/settings/gemini/test`. Clear 400 error when key missing or invalid.
- **Per-tenant Branding & Dynamic PWA Manifest (2026-02)**: each tenant customises `app_name` (≤30), `short_name` (≤12), `theme_color` (hex), and 512×512 `logo_base64`. Endpoints: `GET/PUT/DELETE /api/settings/branding` (branding also included inline in `GET /api/settings`). Client + server auto-crop logos to a centered 512×512 PNG. Frontend `lib/branding.js` builds a Blob-URL manifest and injects it via `<link rel="manifest">`, plus updates `apple-touch-icon`, favicon, `<meta name="theme-color">`, page `<title>`, and `--brand-color` CSS var. `BrandingContext` fetches per-tenant branding on login and clears on logout. Layout header + PWA install prompt read from the live branding state so edits show instantly.
- **Role-Based Access Control (2026-02)**: Two roles: `owner` (self-tenant) and `cashier` (shares owner's `tenant_id`). Login/register response returns `{role, tenant_id}`. Backend guard `require_owner` protects 37 sensitive endpoints (all `/analytics/*`, all `/settings/*` mutations, product mutations, all AI endpoints, expenses, promotion mutations, exports, WA send/receipt/simulate/reminder, `/users/*`). Cashier keeps access to: POS (GET products, POST transactions), shifts (clock-in/out), read settings/branding, read promotions, POST /customers (for credit sales), pay-debt. Frontend `ProtectedRoute ownerOnly` auto-redirects cashiers hitting owner routes to `/`. Layout filters nav items by `role` — cashier sees only Kasir + Shift + Riwayat. New `/staff` module (owner-only) provides CRUD for cashiers with password reset via `PUT /api/users/{uid}`.
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

## Per-Tenant Branding (2026-02)
- Endpoints:
  - `GET /api/settings/branding` — returns `{app_name, short_name, theme_color, logo_base64, updated_at}`
  - `PUT /api/settings/branding` — body: same fields; server auto-crops logo to 512×512 PNG via Pillow
  - `DELETE /api/settings/branding` — reset to defaults
  - Also included in the top-level `GET /api/settings` response under `branding`.
- Validation: theme_color must match `^#[0-9a-fA-F]{6}$`; short_name max 12; app_name max 30; logo_base64 max ~600KB after encoding.
- Frontend `lib/branding.js` (`applyBranding`): dynamically builds a Web App Manifest Blob URL and injects `<link rel="manifest">`, plus updates `<link rel="apple-touch-icon">`, `<link rel="icon">`, `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-title">`, `document.title`, and CSS var `--brand-color`.
- `BrandingContext` fetches per-tenant branding on user change and applies. Layout header reads `short_name` + `logo_base64` from the context; live preview in Settings uses `updateLocal()` on every keystroke.
- `tenant_id` = owner's `user.id`. Cashiers inherit from owner.
- `tenant_of(user)` helper is applied to every DB query/insert.
- Gemini API key stored under `settings.gemini.api_key_enc` (Fernet-encrypted). Never returned to frontend — only `configured: true/false` is exposed.
- Legacy pre-multi-tenant docs backfilled to admin tenant on startup.

## Backlog (P1)
- Blast Promo WA (send AI-bundled promos to past buyers)
- Debt aging alert (>14 days outstanding)

## Backlog (P2)
- Monthly top-cashier auto-award + printable certificate
- Cashier role restriction (limit access to POS-only, hide analytics/settings)

## Refactor / Tech debt
- `/app/backend/server.py` ~2020 lines — split into routers (auth, products, tx, analytics, settings, wa, midtrans, ai, exports)
- `EMERGENT_LLM_KEY` env var + import are now unused since BYOK migration → safe to remove in a cleanup pass
