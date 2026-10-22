# Testing

## Automated checks

| Command | What it runs | Needs |
|---|---|---|
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules, React Compiler checks) | — |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` in strict mode | — |
| `npm test` | Vitest unit/integration tests in `tests/*.test.ts` | — |
| `npm run test:db` | Applies all migrations to a throwaway **Supabase Postgres** container and runs the SQL tests in `tests/db/` | Docker |
| `npm run build` | Production build (also type-checks) | network access for Google Fonts |
| `npm run check` | lint → typecheck → test → build | |

### What the unit tests cover (`npm test`)

| File | Covers |
|---|---|
| `pricing.test.ts` | integer AMD line totals, subtotal, delivery fee and free-delivery threshold, stock caps, `5,000 ֏` formatting |
| `cart.test.ts` | add / merge / increase / decrease / remove / clear, quantity caps, corrupted-storage recovery, reconciliation when prices change or products become unavailable |
| `checkout-validation.test.ts` | phone normalisation (Armenian + international), required fields, length limits, localized error codes, client prices ignored |
| `checkout-service.test.ts` | server checkout: only ids + quantities sent to the DB, invalid input, card disabled, rate limiting, price-changed / unavailable / stock mapping, safe error handling with no PII in logs |
| `telegram.test.ts` | HTML escaping, all required fields in the message, 4096-char limit, API/network failures, token redaction, exactly-once claim, failures recorded without affecting the order |
| `payments.test.ts` | ArCa callback HMAC verification (valid / tampered / unsigned / wrong key), status mapping, AMD minor units, gateway errors, "paid" only after server-side confirmation with matching amount and currency, idempotency |
| `i18n.test.ts` | identical keys and placeholders in hy/ru/en (storefront and admin), no empty strings, Russian plural forms, database-content fallback rules |
| `admin.test.ts` | admin authorization (anonymous / non-admin / admin), every mutation refuses non-admins before touching data, product create/update, mass-assignment rejection, slug conflicts, storage cleanup, order updates limited to workflow columns |
| `slug-and-uploads.test.ts` | Armenian/Russian transliteration for slugs, PostgREST search sanitising, query parsing, upload type/size validation |

### What the database tests cover (`npm run test:db`)

Run against `supabase/postgres` with the real migrations:

- anonymous users read only published catalog data and can't read orders, write products, or
  call privileged functions;
- signed-in non-admins get nothing extra and cannot promote themselves;
- `create_order`: prices from the database, duplicate lines merged, snapshots stored (including
  localized names), idempotent replays, tampered totals rejected, unavailable/draft/unknown
  products rejected, stock enforced and decremented, invalid input rejected;
- Telegram claims are exclusive; payment results are idempotent and never move backwards;
- the rate limiter blocks after the limit;
- admins update workflow fields (audited automatically) but cannot change totals or customer
  data; constraints reject bad slugs/prices/statuses; dashboard revenue is correct;
- deleting a product keeps order history;
- admin product RPCs save atomically and report only truly orphaned images.

## Running the full stack locally

```bash
npx supabase start            # Postgres + Auth + Storage + REST in Docker; applies migrations + seed.sql (demo data)
npx supabase status -o env    # prints API_URL, PUBLISHABLE_KEY, SECRET_KEY
cp .env.example .env.local    # fill NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY / SUPABASE_SECRET_KEY from the status output
ADMIN_EMAIL=admin@example.test ADMIN_PASSWORD='local-dev-password' npm run admin:create
npm run dev                   # http://localhost:3000
```

Stop with `npx supabase stop`.

## Manual verification checklist

Use after deploying (production or preview). Items marked 🔑 need external credentials.

**Storefront**
- [ ] `/` redirects to `/hy`; language switcher keeps the current page; refresh keeps language
- [ ] Product links shared in Russian (`/ru/products/<slug>`) open in Russian
- [ ] Catalog: search, category chips, sorting, pagination; empty search shows the empty state
- [ ] Unavailable product: greyed card, "Unavailable" badge, ordering disabled with an explanation
- [ ] Mobile (≈375 px): header menu, no horizontal scrolling, cart and checkout usable with one hand

**Cart & checkout**
- [ ] Add, change quantity, remove, clear (with confirmation); cart survives a refresh
- [ ] Change a price in admin → cart shows "price changed" and the new total
- [ ] Mark a product unavailable → cart shows it as unavailable and excludes it from the total
- [ ] Submitting the form empty shows localized errors in all three languages
- [ ] Cash-on-delivery order → confirmation page with order number; cart emptied
- [ ] Double-clicking "Place order" creates only one order
- [ ] 🔑 Telegram message arrives with all details
- [ ] With Telegram misconfigured, the order still succeeds and the admin shows the failure + resend

**Admin**
- [ ] `/admin` in a private window redirects to login; a non-admin account is refused
- [ ] Create / edit / delete product; upload, reorder and remove photos; changes visible in the shop immediately
- [ ] Rejected uploads: a PDF and a >5 MB image show errors
- [ ] Orders: filter, search by number and phone, change statuses, internal note, history entries
- [ ] Settings: change delivery fee → checkout totals update

**Payments** — see `PAYMENTS.md` 🔑 (test cards from the bank)

## Known limitations of automated testing

- Telegram and the ArCa gateway are tested with stubbed HTTP; live delivery needs real
  credentials (manual checks above).
- There are no automated browser (Playwright) tests. The following flows were exercised
  manually in Chrome against a production build (`next start`) and a local Supabase stack
  (`supabase start`): admin login (and sign-up blocked at the Auth API), dashboard stats,
  product creation with a real Storage upload (PDF rejected), immediate storefront visibility,
  Russian UI with Armenian name fallback, stock-limited quantity, cart persistence, admin price
  change reflected at checkout, localized validation errors, cash-on-delivery order (one order
  despite a double click; phone normalised; price snapshot; stock decremented and product
  auto-marked unavailable), admin status/note update with history, Telegram failure recorded
  and shown (invalid token → HTTP 401, token not logged), product deletion with Storage cleanup
  and order history preserved.
- Phone-width layouts were **not** checked in a real narrow viewport (the automation browser
  could not be resized); layouts are responsive by construction (Tailwind breakpoints,
  horizontally scrollable chips/tables) but should be checked on a real phone before launch.
