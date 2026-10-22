# Deploying GIPSE

This guide takes the project from this repository to a live site on Vercel with a
Supabase database. Allow about an hour the first time. Every step happens in a web
dashboard except where a terminal command is shown.

**You will need accounts on:** [GitHub](https://github.com), [Supabase](https://supabase.com),
[Vercel](https://vercel.com) and Telegram (for order notifications).

> Never paste real keys into source files, chat messages or screenshots. They go only
> into `.env.local` (your computer, git-ignored) and the Vercel dashboard.

---

## 1. Create the Supabase project

1. Sign in at <https://supabase.com/dashboard> → **New project**.
2. Name it `gipse`, choose a strong database password (store it in a password manager)
   and pick the region closest to Armenia (e.g. **Frankfurt — eu-central-1**).
3. Wait until the project is ready.
4. Open **Project Settings → API Keys** and note:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_…`, click *Reveal*) → `SUPABASE_SECRET_KEY` — **server only**

   Older projects show *anon* and *service_role* JWT keys instead; they work the same way
   (`anon` → publishable, `service_role` → secret).

## 2. Apply the database migrations

The schema, security policies, storage bucket and functions live in
`supabase/migrations/` and must be applied **in filename order**.

**Option A — Supabase CLI (recommended):**

```bash
npx supabase login                       # opens the browser once
npx supabase link --project-ref <ref>    # <ref> is the part before .supabase.co
npx supabase db push                     # applies every migration in supabase/migrations
```

`db push` does **not** load `supabase/seed.sql` (demo data), so production starts empty.

**Option B — SQL Editor:** open **SQL Editor → New query**, paste the contents of each file
in `supabase/migrations/` in order (`…0001…` to `…0004…`) and click **Run** for each.

**Verify:** *Table Editor* lists `products`, `categories`, `orders`, `order_items`,
`order_events`, `payments`, `admin_profiles`, `shop_settings`, `rate_limits` and
`product_images`, each marked **RLS enabled**. *Storage* shows a public bucket
`product-images`.

## 3. Configure authentication and storage

1. **Authentication → Sign In / Providers → Email**: keep Email enabled, and **turn off
   "Allow new users to sign up"**. The shop has exactly one admin, created by you in step 4;
   nobody can register through the website.
2. **Authentication → URL Configuration**: set **Site URL** to your production URL
   (e.g. `https://gipse.vercel.app`, later your custom domain).
3. **Authentication → Policies / Passwords** (if shown): set a minimum length of 12.
4. **Storage**: the migration already created the `product-images` bucket with a 5 MB
   limit and JPG/PNG/WebP/AVIF only, plus policies that let only admins upload or delete.
   Nothing to change.

## 4. Create the administrator (securely)

There is intentionally **no setup page** on the website. Choose one:

**Option A — Dashboard (no terminal):**

1. **Authentication → Users → Add user → Create new user**. Enter the owner's email and a
   long passphrase; tick **Auto Confirm User**.
2. **SQL Editor**: open `supabase/admin/grant_admin.sql`, replace the email, run it. The
   final `select` should list the user with role `admin`.

**Option B — Script from your computer:**

```bash
# .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='a-long-unique-passphrase' npm run admin:create
```

To add or remove admins later, insert or delete rows in `admin_profiles` (see the comments in
`grant_admin.sql`). A signed-in user without a row there is refused everywhere in `/admin`.

## 5. Row Level Security — what is already enforced

The migrations enable RLS on every table. Summary:

| Data | Public (anon) | Admin | Server (secret key) |
|---|---|---|---|
| Published products, images, categories, shop settings | read | full | full |
| Draft (unpublished) products | — | full | full |
| Orders, order items, history, payments | — | read; update **only** `order_status`, `payment_status`, `admin_note` | full |
| `admin_profiles` | — | read own row | full |
| `rate_limits` | — | — | full |
| Storage `product-images` | read files | upload / replace / delete | full |

Orders are created only through the `create_order` database function, which only the
server can call; it recalculates every price from the database. You do not need to
change any policy. `npm run test:db` re-verifies all of this against a real Postgres.

## 6. Create the Telegram bot

1. In Telegram, open **@BotFather** → `/newbot` → choose a name (e.g. *GIPSE Orders*) and a
   username ending in `bot`. BotFather replies with a token like `123456789:AA…` →
   this is `TELEGRAM_BOT_TOKEN`. Keep it secret.
2. **Get the chat ID**
   - *Personal chat:* send any message to your new bot, then open
     `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and copy
     `"chat":{"id": …}` (a positive number).
   - *Shop group:* add the bot to the group, send a message in the group, open the same
     `getUpdates` URL and copy the group's chat id (a negative number, usually `-100…`).
     If `getUpdates` is empty, disable the bot's privacy mode in BotFather
     (`/setprivacy` → Disable) or mention the bot in the group message.
3. That number is `TELEGRAM_CHAT_ID`.

The bot only **sends** messages; it needs no webhook.

## 7. Environment variables

| Variable | Where it is used | Example |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical URLs, sitemap, payment return URLs | `https://gipse.am` |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | `https://abcd1234.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | **server only** — checkout, rate limits, Telegram, payments | `sb_secret_…` |
| `TELEGRAM_BOT_TOKEN` | **server only** | `123456789:AA…` |
| `TELEGRAM_CHAT_ID` | **server only** | `-1001234567890` |
| `CRON_SECRET` | **server only** — protects `/api/cron/telegram-retry` | output of `openssl rand -hex 32` |
| `ARCA_*` | **server only** — only when online payments are activated, see `PAYMENTS.md` | |

Only the two `NEXT_PUBLIC_SUPABASE_*` values and `NEXT_PUBLIC_SITE_URL` reach the browser.
Never add a `NEXT_PUBLIC_` prefix to any other variable.

For local development copy `.env.example` to `.env.local` and fill it in.

## 8. Create the GitHub repository

```bash
git add -A
git commit -m "GIPSE storefront"
# Create an empty PRIVATE repository on github.com (no README), then:
git remote add origin https://github.com/<you>/gipse.git
git branch -M main
git push -u origin main
```

`.gitignore` already excludes `.env*` files (except `.env.example`), `.vercel` and build output.

## 9. Import the repository into Vercel

1. <https://vercel.com/new> → **Import Git Repository** → choose `gipse`.
2. Framework preset: **Next.js** (auto-detected). Leave build/output settings at defaults.
3. Before clicking Deploy, open **Environment Variables** (next step).

## 10. Configure production variables

In the import screen (or later in **Project → Settings → Environment Variables**) add every
variable from step 7.

- Apply them to **Production** and **Preview**. For Preview you may point
  `NEXT_PUBLIC_SITE_URL` at the preview domain, and you may leave Telegram empty so test
  orders don't notify the shop.
- `NEXT_PUBLIC_*` values are embedded at build time: after changing one, **redeploy**.

## 11. Deploy and inspect the build

Click **Deploy**. In the deployment page open **Building** logs and check that:

- `✓ Compiled successfully`, TypeScript passes and the route table is printed;
- there are no `Error:` lines.

Common problems:

| Symptom | Fix |
|---|---|
| Build error mentioning Supabase / fetch failed | Check the two `NEXT_PUBLIC_SUPABASE_*` variables and redeploy |
| Product images do not load | `NEXT_PUBLIC_SUPABASE_URL` must be set **at build time** (image domain allow-list) — redeploy after setting it |
| Checkout says the shop is not accepting orders | `SUPABASE_SECRET_KEY` missing in Production |
| Admin login loops back to login | Account has no `admin_profiles` row (step 4) |

**Cron:** `vercel.json` schedules `/api/cron/telegram-retry` once a day (06:00 UTC), which
re-sends Telegram notifications that failed. Vercel's Hobby plan allows daily crons; on Pro
you can change the schedule to e.g. `*/15 * * * *`. Vercel sends `CRON_SECRET` automatically.

## 12. Test the production site

Run through this list after every significant deployment:

1. `https://<site>/` redirects to `/hy`; switch to **РУС** and **ENG** — the page reloads in
   that language and the URL changes to `/ru`, `/en`. Refresh — the language stays.
2. Sign in at `/admin/login`. Create a category and a product with 2 photos. Open the shop —
   the product appears (no redeploy needed).
3. Add it to the cart, change quantity, refresh — the cart persists.
4. Check out with **cash on delivery**. You land on the confirmation page with an order number,
   and the Telegram chat receives the order within seconds.
5. In `/admin/orders` open the order, change status to *Confirmed*, add a note, save. The
   history shows the change.
6. In the admin, change the product price; in another browser with the product in the cart,
   open checkout — the cart shows the new price.
7. Open `/admin` in a private window — you are redirected to the login page.
8. Visit `https://<site>/sitemap.xml` and `/robots.txt`.

Delete the test order's data afterwards if you like (Table Editor → `orders`; items and
history are deleted with it).

## 13. Connect a custom domain (later)

1. Vercel → **Project → Settings → Domains → Add** (e.g. `gipse.am` and `www.gipse.am`).
2. Create the DNS records Vercel shows (A record `76.76.21.21` for the apex, CNAME
   `cname.vercel-dns.com` for `www`) at your registrar. HTTPS is issued automatically.
3. Update `NEXT_PUBLIC_SITE_URL` to `https://gipse.am` and redeploy.
4. Update Supabase **Authentication → URL Configuration → Site URL**.
5. If online payments are active, tell the bank the new callback URL (see `PAYMENTS.md`).

## Updating the database later

Add a new file to `supabase/migrations/` (never edit an applied one), run
`npm run test:db`, then `npx supabase db push`. Regenerate `types/database.ts` with
`npx supabase gen types typescript --linked > types/database.ts` or update it by hand.
