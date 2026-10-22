# GIPSE — Admin guide

This guide is for the shop owner. Everything here is done in the browser; you never need to
touch code or redeploy the site. Changes you save appear in the shop immediately.

The admin panel is available in **Armenian, Russian and English** — switch with the
**ՀԱՅ / РУС / ENG** buttons at the bottom of the menu.

## Signing in

1. Open `https://<your-site>/admin` (for example `https://gipse.am/admin`).
2. Enter the email and password your developer set up for you. There is no "register" page on
   purpose — only your account can manage the shop.
3. To leave, click **Log out** at the bottom of the menu. Always log out on shared computers.

Forgot the password? Ask your developer to reset it in Supabase (Authentication → Users).
After 10 failed attempts in 15 minutes, sign-in is paused briefly to stop password guessing.

## Overview page

Shows numbers calculated from real orders and products:

- **New orders** — orders nobody has looked at yet (status *New*). Click to see them.
- **In progress** — confirmed, being prepared or out for delivery.
- **Revenue** — total of orders that are *Paid* or *Completed*, not counting cancelled or
  refunded ones.
- **Setup status** — tells you whether Telegram notifications and online payments are switched on.
- A red banner appears if a Telegram notification could not be sent (see *Orders* below).

## Products

### Add a product

1. **Products → New product**.
2. **Name (Armenian)** is required. Russian and English are optional — if you leave them empty,
   customers using those languages see the Armenian text. Use the **Հայերեն / Русский / English**
   tabs to switch languages.
3. **Price (AMD)** — whole drams only, e.g. `5000`. Customers see it as `5,000 ֏`.
4. **Photos** — click **Upload photos** and choose one or more images (JPG, PNG, WebP or AVIF,
   up to 5 MB each, up to 10 photos). The **first photo is the main one** shown in the shop; use
   the ← → arrows to reorder and × to remove. Square or portrait (4:5) photos look best.
5. **Category** — optional (create categories first, see below).
6. **Units in stock** — leave empty for made-to-order items. If you enter a number, customers
   cannot order more than that, and the product automatically becomes *Unavailable* when it
   sells out.
7. **Link name (slug)** — filled in automatically from the name; it becomes part of the product
   address (`/products/angel-figurine`). Change it only if you need to; avoid changing it after
   sharing the link.
8. **Visibility**
   - *Visible in the shop* — turn off to keep a product as a hidden draft.
   - *Available for ordering* — turn off when you can't take orders for it; it stays visible
     with an "Unavailable" label.
   - *Feature on the home page* — shows the product in the home page's *Featured* section.
9. Click **Save**.

### Edit or delete

- **Products** → click a product → change anything → **Save**.
- The quick link **Mark unavailable / Mark available** in the product list switches
  availability without opening the product.
- **Delete** (top right on the product page) asks for confirmation. Deleted products disappear
  from the shop, their photos are removed from storage, and past orders keep their details
  (name, price, quantity) exactly as they were.

Changing a product's price never changes existing orders — each order keeps the price at the
moment it was placed. Customers who already have the product in their cart see the new price
before they confirm.

### Search and filters

Use the search box (name or link name), the category menu and the availability menu
(*Available*, *Unavailable*, *Hidden*), then click **Filter**.

## Categories

**Categories** → **New category**: enter the Armenian name (Russian/English optional) and an
**Order** number (lower numbers are shown first). Deleting a category does not delete its
products; they simply lose that category.

## Orders

Every new order also arrives in your Telegram chat (when Telegram is configured).

### Order list

- Filter by status with the buttons at the top (*New*, *Confirmed*, …).
- Search by **order number** (e.g. `GP-1004` or just `1004`) or **phone number**.
- A small red dot next to an order number means its Telegram notification failed.

### Working on an order

Open an order to see the customer's name, phone (tap **to call** on a phone), delivery address,
notes, items and totals. In **Manage order**:

| Order status | Use it when… |
|---|---|
| New | the order just arrived |
| Confirmed | you called the customer and confirmed details |
| Preparing | you are making / packing it |
| Out for delivery | it has left with the courier |
| Completed | the customer received it |
| Cancelled | the order will not be fulfilled |

**Payment status:** *Pending* (not paid yet), *Paid*, *Failed*, *Refunded*. For cash on
delivery, set *Paid* when the money is collected (or mark the order *Completed* — completed
orders count as revenue). Online card payments update to *Paid* automatically once the bank
confirms them.

**Internal note** — only admins see it (e.g. "Customer asked for delivery after 18:00").

Click **Save**. Every change is recorded in the **History** section with the date and time.

Note: totals and the customer's details cannot be edited after an order is placed — this keeps
records trustworthy. If something must change, add an internal note or cancel and ask the
customer to order again.

### Telegram notification failed?

Open the order; the **Telegram** box shows the error. Click **Send notification** to try again.
The site also retries automatically once a day. Repeated failures usually mean the bot token or
chat ID is wrong, or the bot was removed from the group — tell your developer.

## Shop settings

**Settings** lets you change, without any developer help:

- **Delivery fee (AMD)** added to every order (use `0` for free delivery);
- **Free delivery from (AMD)** — orders at or above this amount ship free (leave empty to turn off);
- phone, email, Instagram and Facebook links, and the studio location (in three languages),
  shown in the shop's footer and contact section.

## Good practice

- Use a long, unique password and don't share the admin account.
- Prefer good daylight photos on a plain background — they are the heart of the shop.
- Fill in Russian and English names for your best-selling products; Instagram visitors from
  abroad will appreciate it.
