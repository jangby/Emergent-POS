# KasirPintar AI - PRD

Mobile-first Web POS + Inventory app for Indonesian UMKM.

## Core features (Delivered)
- JWT auth (login/register); admin seeded as robaya05@gmail.com
- **Multi-Tenant architecture (2026-02)**: every registered user is owner of their own isolated tenant; cashiers inherit tenant from owner. All CRUD/analytics/settings filtered by `tenant_id`. Frontend clears IndexedDB + localStorage on login/logout to prevent leakage.
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
- AI Vision OCR receipt scanner (Gemini 3 Flash)
- AI Business Insights & AI Bundle Suggestions (Gemini 3 Flash)
- AI WhatsApp order parser + fully automated WA bot (per-tenant webhook)
- Midtrans QRIS integration (per-tenant credentials, webhook resolves tenant via order_id)
- Fonnte WhatsApp (per-tenant token)
- Offline-first PWA (IndexedDB queue, service worker, background sync, install prompt)
- Dark/light theme toggle
- Sample Indonesian retail products pre-seeded (admin tenant only)

## Multi-Tenancy Model (2026-02)
- `tenant_id` = owner's `user.id`. Registration → `tenant_id = new user's id`. Cashier creation → inherits `current_user.tenant_id`.
- Backend: `get_current_user` returns `{..., tenant_id}`; every DB query/insert scoped via `tenant_of(user)` helper.
- Migration: on startup, any legacy doc lacking `tenant_id` is backfilled to the admin tenant.
- Webhooks: `/api/whatsapp/webhook/{tenant_id}` (per-tenant); Midtrans webhook resolves tenant from `qris_payments.tenant_id` lookup by `order_id`. Legacy `/api/whatsapp/webhook` still exists and routes to admin tenant for backward compat.
- Frontend: `clearAllLocalData()` invoked on login/register/logout; UID mismatch on session bootstrap also wipes cache.

## Backlog (P1)
- Dynamic White-Labeling & Custom PWA Branding (per-tenant App name, short_name, logo, theme color, live preview, dynamic manifest blob)
- Blast Promo WA (send AI-bundled promos to past buyers)
- Debt aging alert (>14 days outstanding)

## Backlog (P2)
- Monthly top-cashier auto-award + printable certificate

## Refactor / Tech debt
- `/app/backend/server.py` ~1900 lines — split into routers (auth, products, tx, analytics, settings, wa, midtrans, exports)
