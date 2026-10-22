# GIPSE — handmade gypsum figurines shop

Production e-commerce site for **GIPSE**, a studio in Aparan, Armenia making handmade gypsum
figurines, toys and gifts. Trilingual storefront (Armenian default, Russian, English), cart and
checkout with server-validated totals, cash on delivery, ArCa card-payment integration (ready to
activate), Telegram order notifications, and a protected admin panel for products, photos,
categories, orders and settings.

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript strict |
| Styling | Tailwind CSS 4, custom accessible components, Lucide icons |
| Data | Supabase Postgres with Row Level Security, Supabase Auth, Supabase Storage |
| Validation | Zod (shared client/server schemas), React Hook Form |
| Hosting | Vercel (serverless; no local disk persistence) |
| Tests | Vitest (unit/integration) + SQL tests against real Supabase Postgres in Docker |

## Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Supabase, Telegram, GitHub and Vercel, step by step
- **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)** — for the shop owner: products, photos, orders, settings
- **[PAYMENTS.md](PAYMENTS.md)** — payment design, ArCa activation, limitations
- **[TESTING.md](TESTING.md)** — test commands, coverage, manual checklist

## Quick start (local)

Requirements: Node.js 20.9+ (22 recommended), npm, Docker (for the local database).

```bash
npm install
npx supabase start                 # local Postgres/Auth/Storage; applies migrations + demo data
npx supabase status -o env         # copy API_URL / PUBLISHABLE_KEY / SECRET_KEY
cp .env.example .env.local         # and fill in the three Supabase values
ADMIN_EMAIL=admin@example.test ADMIN_PASSWORD='choose-a-long-password' npm run admin:create
npm run dev                        # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

Without Docker, point `.env.local` at a hosted Supabase project instead (see DEPLOYMENT.md §1–4).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | route type generation + `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run test:db` | migrations + SQL security/business tests in a disposable Postgres container |
| `npm run check` | lint + typecheck + test + build |
| `npm run admin:create` | create/promote the administrator (uses `SUPABASE_SECRET_KEY`; run locally only) |

## Environment variables

See [`.env.example`](.env.example) and the table in [DEPLOYMENT.md §7](DEPLOYMENT.md#7-environment-variables).
Only `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
are exposed to the browser. `SUPABASE_SECRET_KEY`, `TELEGRAM_*`, `CRON_SECRET` and `ARCA_*` are
server-only.

## Project structure

```
app/
  [locale]/              storefront (hy | ru | en): home, products, product, cart, checkout, order
  admin/                 admin root layout, login
  admin/(panel)/         protected admin pages (dashboard, orders, products, categories, settings)
  api/payments/arca/     payment return + signed callback
  api/cron/              Telegram retry job (Vercel Cron)
  sitemap.ts, robots.ts, icon.svg
components/              UI (storefront, cart, checkout, admin, primitives)
lib/
  actions/               server actions (storefront, payment, admin) — the only mutation entry points
  admin/queries.ts       admin reads (through the admin's RLS-bound session)
  auth/admin.ts          server-side admin verification (getUser + admin_profiles)
  cart/                  pure cart logic + localStorage store
  data/catalog.ts        cached public catalog queries ("use cache" + tags)
  i18n/                  locales, dictionaries, translator, DB-content fallback
  orders/                checkout service, public order view
  payments/              provider interface, ArCa implementation, payment service
  supabase/              public / session / service / browser clients
  telegram/              message formatting, API client, exactly-once notifier
  validation/            Zod schemas (checkout, admin)
messages/                translations (storefront + admin) — hy is the source of truth
supabase/
  migrations/            schema, RLS, grants, storage, functions (apply in order)
  seed.sql               LOCAL demo data only (slugs start with demo-)
  demo/                  script to remove demo data
  admin/grant_admin.sql  admin bootstrap snippet
tests/                   Vitest tests; tests/db = SQL tests
types/database.ts        typed schema for supabase-js
proxy.ts                 locale redirects + admin session refresh (Next 16 "proxy", formerly middleware)
```

## Architecture notes

- **Prices are never trusted from the browser.** The cart in `localStorage` is a convenience;
  checkout sends only product ids and quantities. `create_order` (Postgres, one transaction)
  locks the products, rejects unavailable/draft/out-of-stock items, recomputes subtotal and
  delivery fee from the database, compares with the total the customer saw (to surface price
  changes), and writes the order with item snapshots.
- **Idempotent checkout.** Each cart snapshot carries an idempotency key; retries and double
  clicks return the same order.
- **Telegram after commit.** The order is saved first; notification runs after the response
  (`after()`), is claimed in the database to avoid duplicates, and failures are recorded,
  shown in the admin panel with a resend button, and retried daily by cron.
- **Defence in depth for admin.** Proxy redirect (UX only) → `requireAdminPage`/`requireAdmin`
  on every page and action (Supabase `getUser()` + `admin_profiles`) → strict Zod schemas →
  RLS policies and column-level grants in Postgres.
- **Caching.** Public catalog reads use `"use cache"` with a `catalog` tag; admin mutations call
  `updateTag()` so changes appear immediately. Admin pages, cart, checkout and order pages are
  never publicly cached.
- **Images.** Uploaded from the admin's browser straight to Supabase Storage (bucket enforces
  5 MB and image MIME types; policies allow only admins); random UUID filenames; orphaned
  files are deleted when no product references them.

## Assumptions

- Delivery within Armenia is the only shipping method; the fee and free-delivery threshold are
  set by the owner in **Admin → Settings** (no fee is assumed — default 0).
- Stock tracking is optional per product (empty = made to order). Cancelling an order does not
  restock automatically; adjust the stock in the product form if needed.
- Untranslated product/category fields fall back to Armenian, then the other language.
- Prices are whole AMD; displayed as `5,000 ֏` in every language.
- Brand palette (warm ivory/cream/clay) and the GIPSE wordmark were designed from the Instagram
  profile's handmade style; replace with official assets when available.
- The admin panel UI follows the admin's chosen language (default Armenian).
