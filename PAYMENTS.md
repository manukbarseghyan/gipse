# Payments

GIPSE supports two payment methods:

| Method | Status |
|---|---|
| **Cash on delivery** | ✅ Works out of the box. Orders are saved with payment status *Pending*; the admin marks them *Paid* when the courier collects the money (or simply sets the order to *Completed*, which counts toward revenue). |
| **Online card payment (ArCa)** | ⚙️ Fully implemented but **disabled until merchant credentials are configured**. While disabled, the checkout shows the card option greyed out with "Online card payment is not available yet". |

No payment is ever simulated. Without credentials the card option cannot be selected, and
the server rejects card orders.

## Why ArCa

Stripe, PayPal and similar global providers do not onboard merchants registered in Armenia.
Armenian e-commerce card acceptance runs through **ArCa (Armenian Card)**, the national
processing centre, via an internet-acquiring agreement with an Armenian bank (e.g. Ameriabank,
Ardshinbank, Inecobank, ACBA, Evocabank, Converse Bank). Most of these banks provide the
**ArCa iPay / BPC SmartVista REST API** (`register.do`, `getOrderStatusExtended.do`), which is
what `lib/payments/arca.ts` implements. It accepts ArCa, Visa and Mastercard cards and
settles in AMD.

Other Armenian options (Idram, Telcell, EasyPay, a bank-specific vPOS API) can be added by
implementing the `PaymentProvider` interface in `lib/payments/types.ts` and registering it in
`lib/payments/index.ts`.

> Requirements, fees and exact endpoints differ by bank and change over time. Confirm them
> with your bank during onboarding; the integration below follows the standard ArCa iPay
> merchant API.

## How it works

```
Customer                  GIPSE (Vercel)                         ArCa gateway
   │  Place order (card)       │                                        │
   ├──────────────────────────▶│ create_order() — totals from DB        │
   │                           │ insert payments row (attempt GP-1001-1)│
   │                           ├── register.do (amount×100, AMD 051) ──▶│
   │                           │◀──────────── orderId, formUrl ─────────┤
   │◀── redirect to formUrl ───┤                                        │
   │──────────── enters card details on the bank's page ───────────────▶│
   │                           │◀──── callback (mdOrder, checksum) ─────┤  ① signed callback
   │                           ├── getOrderStatusExtended.do ──────────▶│  ② server-to-server check
   │                           │◀────── orderStatus=2, amount ──────────┤
   │                           │ record_payment_result(paid) — idempotent
   │◀── redirect to returnUrl ─┤ (re-checks status the same way)        │
   │  confirmation page        │                                        │
```

Security properties:

- **Credentials stay on the server** (`ARCA_*` variables have no `NEXT_PUBLIC_` prefix).
- **Sessions are created server-side** with the amount taken from the saved order, never from
  the browser.
- **An order becomes "Paid" only after an authenticated server-to-server status request**
  (`getOrderStatusExtended.do` with our merchant credentials) reports `orderStatus = 2` **and**
  the amount and currency match the order exactly. The browser redirect and the callback only
  *trigger* that check — a forged redirect or callback cannot mark anything paid.
- **Callback signatures are verified** when `ARCA_CALLBACK_SECRET` is set: HMAC-SHA256 over the
  sorted `name;value;` parameter string, compared in constant time. Invalid signatures get
  HTTP 403.
- **Idempotent:** each attempt has a unique reference (`GP-1001-1`, `GP-1001-2`, …) so the
  gateway never charges the same attempt twice; `record_payment_result` only moves forward
  (`pending → paid/failed`), so repeated callbacks are no-ops, and a paid order can never be
  flipped back to failed.
- One-stage payments are used (no separate capture). A pre-authorised hold
  (`orderStatus = 1`) is **not** treated as paid.

## Activating online payments

1. **Sign an internet-acquiring agreement** with an Armenian bank. Ask specifically for
   *"ArCa iPay REST API (register.do / getOrderStatusExtended.do), one-stage payments,
   callback notifications with checksum"*. You will typically need business registration
   documents, a public website with prices, contact details, delivery and refund terms.
2. The bank provides **test credentials** and a **test gateway URL**, for example
   `https://ipaytest.arca.am:8445/payment/rest` (production is usually
   `https://ipay.arca.am/payment/rest`). Use exactly what your bank gives you.
3. Ask the bank to configure the **callback URL**:
   `https://<your-domain>/api/payments/arca/callback`
   and to enable **checksum (symmetric key)** — they give you the secret key.
4. Set the variables in Vercel (Preview first, with test credentials):

   ```
   ARCA_API_BASE_URL=https://ipaytest.arca.am:8445/payment/rest
   ARCA_USERNAME=<api user>
   ARCA_PASSWORD=<api password>
   ARCA_CALLBACK_SECRET=<checksum key>
   ```

5. Redeploy. The admin dashboard's *Setup status* now shows "Online card payments are enabled",
   and the checkout's card option becomes selectable.
6. **Test on the Preview deployment** with the bank's test cards:
   - successful payment → order page shows *Paid*; admin order history shows
     "Online payment result: Paid";
   - declined card → order page offers *Try again*; payment status *Failed*;
   - close the bank page midway → order stays *Pending*, customer can pay later from the
     order page.
7. Switch the variables in **Production** to the live credentials the bank issues after
   certification, and redeploy.

If `ARCA_CALLBACK_SECRET` is not set, callbacks are still accepted but only as a trigger for
the authenticated status check (still safe), and you should ask the bank to enable checksums.

## Refunds

Refunds are made in the bank's merchant portal. Afterwards set the order's payment status to
**Refunded** in the admin panel so revenue figures stay correct.

## Limitations

- Not yet tested against a live ArCa gateway because merchant credentials are not available.
  The request/response handling follows the documented iPay API and is covered by unit tests
  with recorded response shapes (`tests/payments.test.ts`); run the bank's test-card scenarios
  above before going live.
- Payment parameter names can differ slightly between banks' API versions — compare
  `lib/payments/arca.ts` with your bank's merchant manual during onboarding.
- Currency is fixed to AMD (`051`), amounts are sent in minor units (AMD × 100) as the API requires.
