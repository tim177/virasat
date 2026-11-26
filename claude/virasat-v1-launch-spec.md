# Virasat Prototype (v1): Build Plan

**Version:** 2.0 · 24 Nov 2026
**Goal:** a small but **complete** online store to test the market. It should look premium, work well on phones, take real payments, and let us process every order from payment to delivery.
**How:** we build it ourselves as **one Next.js app with a Postgres database**, and use hosted services for the risky parts (payments, login, email).
**Long-term reference:** `virasat-build-spec.md` describes the big v2 platform. Don't build that now. Use it only for product and screen ideas, and come back to it when the prototype proves demand.

---

## 1. Decisions at a glance

| Topic | Decision |
|---|---|
| **How we build** | Our own code: one Next.js app (shop + admin + API) and one Postgres database. No commerce framework |
| **Market** | **US only**, prices in **USD**, English |
| **Who sells** | The **US company** is the seller. The Indian company makes and exports the clothes |
| **Payments** | **Stripe Checkout**, Stripe's hosted payment page: cards, Apple Pay, Google Pay, Link, optional pay-later options |
| **PayPal** | After launch, if customers ask for it |
| **Prices** | **All-inclusive:** duties, import taxes and express shipping are inside the price. "No fees on delivery." |
| **Shipping** | Free express shipping on every order. Labels booked by hand on the courier's website |
| **Cheapest product** | About **$150** (≈ ₹14,000) or more, because shipping alone costs ₹3,500–6,000 |
| **Returns** | 7 days, exchange or store credit (details in section 6) |
| **Custom fit** | Measurement form on the product page, fit call through Cal.com, no returns, free alterations |
| **Mobile** | Responsive website, **installable as a PWA** (home-screen icon, full screen) |
| **Login** | Email one-time code or Google. Admin login needs 2FA |
| **Hosting** | One Google Cloud VM with Docker Compose. The free trial covers the first 90 days |
| **Not used** | Redis, job queues, search engine, microservices, Medusa, Shopify, Vercel |

Money in this plan uses **$1 ≈ ₹94** (rate in mid-November 2026).

---

## 2. What the prototype includes

### For customers (phone and desktop)

| Page | What it does |
|---|---|
| **Home** | Hero, trust strip ("Duties & taxes included · Free express shipping"), category arches, occasions, featured products |
| **Category pages** | Product grid with filters (category, occasion, colour, fabric) and sorting by newest or price |
| **Product page** | Photo gallery, price, size selector **or "Custom fit"**, delivery date range, details and care, size guide, "Add to bag" |
| **Custom-fit form** | Measurement form (inch/cm) with help text and range checks. Saved with the order |
| **Search** | Simple search box. Understands common spellings (ghagra / lengha → lehenga) |
| **Bag** | Items, sizes or measurements, quantity, remove, total. Kept in the browser |
| **Checkout** | **Stripe's hosted page.** Stripe also collects the shipping address and phone number |
| **Order confirmed** | Order number, what happens next, and for custom fit a "Book your fit call" button |
| **Order status** | Timeline (Paid → Confirmed → In production → Shipped → Delivered) with the tracking link. Opened from the email link; no account needed |
| **Account** (optional) | Log in with an email code or Google. See all orders and saved measurements |
| **Info pages** | About, size guide, shipping & returns, privacy, terms, contact form |

### For you (admin, at `/admin`)

| Page | What it does |
|---|---|
| **Dashboard** | Orders and revenue today, this week and this month. Orders waiting for action |
| **Orders** | List with status filter. Order page shows items, measurements, address and payment, with buttons to move the order forward and add a tracking number |
| **Products** | Add and edit products, prices, sizes, stock, photos (with alt text), publish or unpublish |
| **Admin log** | Every admin change: who did it, when, and what changed |

Refunds and payment disputes are handled in **Stripe's dashboard** (no code needed). Stripe tells our app about refunds, and the order updates automatically.

### Not in the prototype (added later if the market test works)
India, other countries, multiple currencies, PayPal, discount engine (we use Stripe promo codes instead), wishlist, reviews, SMS/WhatsApp, returns portal, automatic shipping labels, search engine, multiple languages, native app.

---

## 3. How it works

### The pieces

```
Shopper (phone browser, installed PWA, or desktop)
        │ HTTPS
Cloudflare (free): domain, SSL, caching, bot protection
        │
Google Cloud VM (e2-medium, 4 GB RAM), Docker Compose
 ├─ caddy      receives web traffic, handles HTTPS
 ├─ web        our Next.js app: shop pages + /admin + /api routes
 └─ postgres   all data (products, orders, customers)
        │
Outside services:
  Stripe (payments) · Resend (emails) · Cloudflare R2 (product photos)
  Cal.com (fit calls) · Sentry (error alerts) · PostHog (analytics)
  Courier website (shipping labels, booked by hand)
```

### What happens when someone buys

```
1. Customer adds items to the bag            → bag is saved in their browser
2. Customer taps "Checkout"                  → our server reads the REAL prices from our database,
                                               saves a checkout draft (items + measurements),
                                               and opens a Stripe payment page
3. Customer pays on Stripe                   → Stripe handles cards, Apple Pay, Google Pay, 3-D Secure
4. Stripe tells our server "paid" (webhook)  → we create the order ONCE (keyed by Stripe's session ID),
                                               reduce stock, and send the confirmation email
5. Customer lands on "Order confirmed"       → the page reads the order; it never creates it
6. You open /admin → Orders                  → Confirm → In production → Shipped (add tracking,
                                               email goes out) → Delivered
```

**Why this design is safe:**
- The browser never decides prices.
- Card details never touch our server.
- An order only exists if Stripe confirmed the payment.
- A payment can never create two orders.

---

## 4. Tech stack

| Part | Choice | Why |
|---|---|---|
| App | **Next.js** (App Router, latest stable, exact version pinned), **TypeScript strict** | One app for shop, admin and API. Server-rendered pages are fast and SEO-friendly |
| Styling | **Tailwind CSS** with the Virasat design tokens | Matches the design system exactly |
| Database | **PostgreSQL 16** with **Prisma** | Simple, reliable, well known by AI coding tools |
| Login | **Better Auth** (open-source library): email one-time code, Google login, admin 2FA, built-in rate limits | Free, runs inside our app, no external auth service |
| Payments | **Stripe Checkout** + Stripe webhooks | Hosted payment page; we never build a card form |
| Email | **Resend** + **React Email** templates | Order emails and login codes |
| Photos | **Cloudflare R2**, served through Cloudflare's cache, resized by `next/image` | Cheap, fast |
| Validation | **Zod** | Checks every input on the server |
| Tests | **Vitest** (unit + integration), **Playwright** (browser tests) | |
| Errors / analytics | **Sentry**, **PostHog** | Free tiers |
| Hosting | **Google Cloud VM** + **Docker Compose** + **Caddy** | One server, simple to run and to move later |
| Tools | **Node.js 22 or 24 LTS**, **pnpm**, **git**, **GitHub Actions** | |

### Folder layout

```
/                    Next.js app (repo root)
├─ app/
│  ├─ (shop)/        home, category, product, search, bag, order pages, account, info pages
│  ├─ admin/         dashboard, orders, products, admin log
│  ├─ api/           checkout, stripe webhook, uploads, cron, contact
│  └─ manifest.ts    PWA manifest
├─ components/       design-system components (Button, Price, ProductCard, ZariRule, ...)
├─ lib/              db, auth, stripe, email, orders (status rules), money, measurements
├─ prisma/           schema.prisma, migrations, seed.ts
├─ emails/           React Email templates
├─ tests/            unit, integration, e2e
├─ claude/           specs (this file)
├─ docker-compose.yml        local: postgres only
└─ docker-compose.prod.yml   server: caddy + web + postgres
```

---

## 5. Services and costs (in ₹)

### Services

| Service | What for | When | Cost |
|---|---|---|---|
| **Stripe** (US company) | Payments | Step 5 | 2.9% + $0.30 per order (≈ ₹846 on a $300 order) |
| **Courier**: DHL Express business account, or an aggregator | Shipping to the US with duties paid by us (DDP) | Step 0 | ≈ ₹3,450–6,200 per 2–3 kg parcel (published rates; ask for a business quote) |
| **Customs broker** | HS codes and current US duty rates | Step 0 | One-time consultation |
| **Resend** | Emails and login codes | Step 5 | ₹0 (free tier) |
| **Better Auth** + Google login | Admin login (Step 6), customer login (Step 7) | Step 6 | ₹0 |
| **Cloudflare** | DNS, SSL, cache, Turnstile, R2 photo storage | Step 3 | ₹0 (free tiers) |
| **Google Cloud** | Hosting | Step 6 | ₹0 for 90 days, then ≈ ₹2,500–3,000/month |
| **Cal.com** | Fit-call booking | Step 7 | ₹0 (free plan) |
| **Sentry, PostHog** | Error alerts, analytics | Step 1 | ₹0 (free tiers) |
| **Domain** (.com) | Web address | Step 0 | ≈ ₹1,000–1,500/year |

### Budget for the first 3 months

| Item | Cost |
|---|---|
| Domain | ≈ ₹1,500 |
| Hosting | ₹0 (Google Cloud trial) |
| All software and services | ₹0 (free tiers) |
| 2 test parcels to the US | ≈ ₹8,000–12,000 |
| **Total** | **≈ ₹10,000–14,000** |

**After the trial:** ≈ ₹2,500–3,000/month for hosting, plus per-order costs.
**Not counted:** product stock, photography and packaging. Good photos are the biggest part of a "premium" look.

### What one order costs you ($300 ≈ ₹28,200 lehenga)

| Cost | Approx. |
|---|---|
| Stripe fee | ₹846 |
| Express shipping (2–3 kg) | ₹3,450–6,200 |
| Packaging | ₹200–400 (estimate) |
| **US import duty** | **Unknown. Get it from a customs broker before setting prices** (see risk R1) |

**Price formula:** product cost + shipping + duty + Stripe fee + packaging + your margin = the US price.

---

## 6. Store policies (decided)

| Policy | Rule |
|---|---|
| **Returns (ready-to-wear)** | Within **7 days of delivery**, unworn, with tags. The customer gets an **exchange or store credit** and pays the return shipping |
| **Store credit** | A one-time Stripe promotion code for the amount. Nothing extra to build |
| **Damaged or wrong item** | Report within **48 hours** with photos. We replace it or refund in full |
| **Custom fit** | **No returns.** If the fit is off, we pay a local tailor up to **$25** (≈ ₹2,350) for alterations, against a receipt |
| **Cancellations** | Free until the order moves to "In production". After that, ready-to-wear can be cancelled until shipped; custom fit can't |
| **Shipping** | Free express shipping on every order, US addresses only |
| **Duties and taxes** | Included in the price. "No fees on delivery." |
| **Delivery promise** | Shown as a date range: production days + 4–7 shipping days, with a buffer. If we'll miss it, we email the customer and offer a cancellation with a full refund (the US FTC's mail-order rule requires this) |

---

## 7. Database

Money columns are **integer cents** (`*_cents`, e.g. $249.00 is stored as `24900`) with currency `USD`. Never floats.

| Table | Main fields |
|---|---|
| **users**, sessions, accounts, verifications, two_factors | Created by Better Auth. We add `role` (`customer` or `admin`) to users |
| **products** | id, slug, title, description, category (lehenga, saree, anarkali, sherwani, kurta_set), gender, fabric, work, colour, occasions[], care, hs_code, `price_cents`, `compare_at_cents`, `custom_fit_available`, `custom_fit_extra_cents`, `ready_days`, `custom_days`, status (draft/published), timestamps |
| **product_images** | id, product_id, url, alt (required), position |
| **variants** | id, product_id, size label, sku, `stock` (a number, or empty = made to order) |
| **checkout_drafts** | id, items (json: product, size or custom, qty, measurements), user_id, stripe_session_id, created_at. Holds the bag while the customer is on Stripe |
| **orders** | id, `number` (VRS-1001, VRS-1002…), status, email, phone, customer_name, shipping_address (json), user_id, `subtotal_cents`, `shipping_cents` (0), `total_cents`, currency, `stripe_session_id` (**unique**), stripe_payment_intent_id, access_token (for the email link), courier, tracking_number, confirmation_sent_at, timestamps (paid, shipped, delivered, cancelled, refunded) |
| **order_items** | id, order_id, product_id, **snapshots** (title, image, size), is_custom, **measurements** (json, copied at purchase), `unit_price_cents`, qty |
| **order_events** | id, order_id, from_status, to_status, note, actor (admin user, "stripe" or "system"), created_at |
| **fit_profiles** | id, user_id, name ("Me", "Mum"), kind (women / men), units, measurements (json), updated_at |
| **admin_log** | id, admin_user_id, action, entity, entity_id, before (json), after (json), ip, created_at |

**Important indexes:** orders (status, created_at), orders (email), orders (stripe_session_id, unique), products (status, category), variants (product_id).

### Order statuses

```
paid ──► confirmed ──► in_production ──► shipped ──► delivered
  │          │               │
  └──────────┴───────────────┴──► cancelled
                (from in_production only if the order has no custom-fit items)

Full refund made in Stripe (from any status) ──► refunded
```

| Status | Meaning | Who moves it |
|---|---|---|
| `paid` | Stripe confirmed the payment | Stripe webhook |
| `confirmed` | You checked the order. For custom fit: measurements confirmed after the fit call | Admin |
| `in_production` | Being made or prepared | Admin |
| `shipped` | Tracking number added; customer emailed | Admin |
| `delivered` | Courier shows it delivered | Admin |
| `cancelled` | Cancelled under the policy | Admin |
| `refunded` | The **full** amount was refunded in Stripe's dashboard. A partial refund (for example an alteration payment) only adds a note to the order and doesn't change its status | Stripe webhook |

All moves go through **one function** (`lib/orders`) that knows the allowed moves. Every move writes an `order_events` row.

---

## 8. Step-by-step build

Times assume **one full-time developer using Claude Code**. Part-time roughly doubles them.
Each step ends with **"Done when"**. Finish it before starting the next step.

| Week | Steps |
|---|---|
| Alongside the build | Step 0: business setup |
| 1 | Step 1: project setup · Step 2: design system |
| 2 | Step 3: database and products · Step 4: shop pages |
| 3 | Step 5: bag, Stripe, orders, emails |
| 4 | Step 6: admin + first deploy to Google Cloud |
| 5 | Step 7: accounts, custom fit, order status page |
| 6 | Step 8: PWA and polish · Step 9: launch checks and go live |

### Step 0: Business setup (no code, runs alongside the build)
1. **CA:**
   - Set up how the US company buys from the Indian company.
   - Confirm export papers from India: IEC, GST + LUT, AD code, proof of foreign payments.
   - Confirm who is the importer for US customs.
2. **Customs broker:**
   - Get HS codes and the **current US duty rate** for each product type.
   - **Go/no-go check:** if duty makes prices too high, test in India first (Indian company + Razorpay) or another country.
3. **Stripe account** for the US company: US bank account, EIN, business details. Turn on the payment methods you want (cards, Apple Pay, Google Pay, Link, optionally Klarna/Afterpay/Affirm).
4. **Courier:** get quotes from DHL Express (business account with duties billed to us) and one aggregator, and pick the cheaper reliable one.
5. **Tailor:** the measurement list for women's and men's custom fit, the allowed min/max for each measurement, and how-to-measure notes.
6. **Content:** 20–40 launch products (all above about $150) with good photos, descriptions and a size chart.
7. **Domain** and the **policy texts** (section 6).

**Done when:** the US duty rate is known and prices are set, the Stripe account is approved (test mode is enough to start building), the courier is chosen, and the tailor's measurement list is ready.

### Step 1: Project setup · ~2 days
1. Install Node.js 22/24 LTS, pnpm, Docker Desktop and git. Run `git init`.
2. Create the Next.js app (TypeScript strict, Tailwind, ESLint) at the repo root.
3. `docker-compose.yml` with **postgres:16 only**. Add Prisma and connect it.
4. Add Vitest, Playwright, Prettier, `.env.example` (never commit `.env`), `.nvmrc`.
5. Add Sentry and PostHog (with keys in `.env`).
6. GitHub repo + GitHub Actions running lint, typecheck, tests and build on every push.

**Done when:** `pnpm dev` shows a page at `localhost:3000` connected to the local database, and CI is green.

### Step 2: Design system · ~3 days
1. Put the Virasat tokens (colours, fonts, type scale, radii, two shadows, spacing) into the Tailwind config. Load Playfair Display and Inter with `next/font`.
2. Build these components in `components/`:
   - Button, IconButton, Input, Select, Checkbox, Radio, Badge, **Price** (USD, tabular figures)
   - ProductCard, Gallery, Accordion, Modal, Drawer, Toast, Breadcrumbs, EmptyState, Skeleton, Stepper, StatusPill, Timeline
   - **ZariRule**, **Jaali** placeholder
3. Build the site header (logo, categories, search, account, bag) and footer, both mobile-first.
4. Add a `/dev/components` page to preview everything (hidden in production).

**Done when:** every component works by keyboard, has visible focus, 44px tap targets and 4.5:1 contrast, and passes an axe check.

### Step 3: Database and products · ~2 days
1. Write `schema.prisma` for the **catalogue tables** (products, product_images, variants), plus database CHECK rules for money, stock, slugs and alt text, then run the first migration.
   - The order tables (checkout_drafts, orders, order_items, order_events) arrive in Step 5, the admin tables (users, sessions, admin_log) in Step 6, and fit_profiles in Step 7. Each ships in its own migration with the code and tests that use it.
2. Seed script with about 12 sample products for development. The photos are generated sample artwork in `/public/seed`, not real photos. The script refuses to run against a non-local database unless `ALLOW_SEED=true`.
3. Allow the photo address (`IMAGES_BASE_URL`, the R2 bucket on `images.<domain>`) in `next/image`. **Creating the R2 bucket needs your Cloudflare account. Do it before Step 6**, when admin photo uploads arrive.

**Done when:** `pnpm db:seed` fills the database and the seeded photos load through `next/image`. Integration tests prove the database rejects bad prices, stock and alt text.

### Step 4: Shop pages · ~5 days
1. **Home:**
   - Section text and images come from a typed config file in the repo.
   - Product rows (featured, by occasion) come from the database.
2. **Category pages** (`/c/[category]`):
   - Grid of 24 + "Load more".
   - Filters: occasion, colour, fabric. Sort: newest, price low–high, price high–low.
   - Filters are kept in the URL so links can be shared.
3. **Product page** (`/p/[slug]`):
   - Gallery, price, size buttons (sold-out sizes disabled) and a "Custom fit (+$X)" option.
   - Delivery date range, accordions for details and care, a size guide modal.
   - "Add to bag" is disabled until a size or custom fit is chosen, with the reason shown.
4. **Search** (`/search?q=`): a database search on title, category, colour and fabric, a small synonyms list, and a helpful "no results" page.
5. **SEO:** page titles and descriptions, product structured data, `sitemap.xml`, `robots.txt`.
6. **Speed:** pages are built on the server and cached. When a product is saved in admin, its pages refresh right away.
7. **Analytics:** `view_item_list`, `view_item`, `search`, `search_no_results`.

**Done when:** on a phone, Lighthouse scores are **≥ 90 performance** and **100 accessibility** on the home, category and product pages; everything works at 360px width; and a Playwright browse test passes.

**Notes from building Step 4:**
- An extra **`/shop`** page lists every piece (with a category filter). The home page's occasion links land there.
- **Not-found pages:** an unknown product or category shows the shop's not-found page with a `noindex` tag. With Cache Components the response has already started as HTTP 200 by then (documented Next.js 16 behaviour), so it isn't a 404 status. Search engines still drop it.
- **"Add to bag"** shows an "almost ready" message until the bag exists (Step 5).
- **Lighthouse (mobile, local production build, median of 3):** home 91, category 91, product 93 for performance; 100 accessibility on all three; layout shift 0.
- **What it took to hit 90:**
  - Sentry and PostHog load only when their keys are set.
  - Grid, hero and category photos render as plain `<img>` via `getImageProps` (no client JavaScript).
  - The main image uses `fetchPriority="high"`.
  - Only the body font is preloaded.
  - Dialogs render their contents only while open.

### Step 5: Bag, payment, orders and emails · ~5–6 days
This is the most important step. Take it slowly and test it well.

1. **Bag:**
   - Stored in the browser (localStorage).
   - A drawer and a `/bag` page: change quantity, remove items, "Edit measurements" for custom-fit items.
2. **Checkout** (`POST /api/checkout`):
   1. Check the bag with Zod.
   2. Load **real prices and stock** from the database.
   3. Save a `checkout_draft`.
   4. Create a **Stripe Checkout Session** with:
      - line items from our database prices
      - shipping address collection for the US only, phone number collection
      - promotion codes allowed (used for store credit)
      - the draft ID in the session metadata
   5. Send the customer to Stripe.
3. **Stripe webhook** (`POST /api/stripe/webhook`):
   1. **Verify the signature.**
   2. On `checkout.session.completed`, **only if `payment_status` is `paid`**, in one database transaction:
      - create the order (unique `stripe_session_id`, so a repeated webhook creates nothing new)
      - copy the items and measurements from the draft
      - reduce stock
      - write an `order_events` row
   3. After saving, send the emails. If an email fails, the order is still saved, and a retry job sends it later.
   4. On `charge.refunded`: if the whole amount is refunded, set the order to `refunded`. If only part is refunded, add a note to the order instead.
   5. Turn on **instant payment methods only** (cards, Apple Pay, Google Pay, Link, pay-later). Bank-transfer methods confirm days later and would need extra handling.
4. **Order confirmed page** (`/checkout/success?session_id=…`):
   - Reads the order. If the webhook hasn't arrived yet, it shows "Confirming your payment…" and checks again every 2 seconds.
   - Refreshing the page is safe.
5. **Emails** (Resend + React Email, Virasat style):
   - order confirmation, with the order status link and, for custom fit, the fit-call booking link
   - shipped, with tracking
   - delivered
   - cancelled / refunded
   - **new-order alert to you**
6. Set up **SPF, DKIM and DMARC** for the domain in Resend, so emails don't land in spam.
7. Turn on Stripe's own **email receipts**.
8. **Analytics:** `add_to_cart`, `begin_checkout`, and `purchase` (sent from the server).

**Done when:**
- A Playwright test passes: browse → add to bag → pay with Stripe's test card, **including the 3-D Secure test card** → confirmation page → order in the database → email sent.
- **Sending the same webhook twice creates only one order** (integration test).
- Unit tests pass for price calculation and the order status rules.
- Locally, webhooks arrive through `stripe listen`.

**Notes from building Step 5:**
- **No bag drawer.** "Add to bag" shows a toast with a "View bag" link, and the header shows the item count. The `/bag` page does the rest. A drawer would add client JavaScript to every product page for little gain.
- **Custom-fit lines have no measurements until Step 7.** The measurement form and "Edit measurements" arrive with it. Until then, drafts and orders store `measurements: null`, and the confirmation says we'll book a fit call.
- **Adaptive Pricing is off** (`adaptive_pricing: { enabled: false }`), so customers always pay the all-inclusive USD price. If a payment ever arrives in another currency anyway, the order records Stripe's USD amounts and adds a note.
- **Payment methods are chosen in the Stripe dashboard**, not in code. Turn off "Bank" (ACH) there. The webhook also handles `checkout.session.async_payment_succeeded`, so a delayed method can't lose an order if one is ever switched on.
- **Emails built now:** order confirmation, new-order alert to you, and full refund. **Shipped, delivered and cancelled emails come with the admin in Step 6**, because the admin's status buttons send them. The order-status link and the Cal.com link in the confirmation come in Step 7.
- **Failed emails:** the hourly cron (`/api/cron/emails`) retries confirmations and admin alerts. A failed refund email is not retried. It is recorded as an order note ("Email the customer"), because the refund itself has already happened.
- **Checkout drafts** are deleted after 7 days by a daily cron (`/api/cron/drafts`). Stripe sessions expire within 24 hours, so a week leaves room for late webhook retries.
- **`purchase` analytics is sent from the order-confirmed page** (once per order), not from the server. Sending it from the server needs PostHog's Node SDK, which can come later if ad blockers hide too many purchases.
- **Stripe e2e runs locally only.** It needs real test keys and `pnpm stripe:listen` (see README). CI runs the bag tests and the webhook integration tests, with fake keys and signed test events.
- **Email templates** use plain React + `@react-email/render`, because `@react-email/components` is deprecated.
- **Still to do outside the code:** SPF/DKIM/DMARC (with the Resend account and domain), and turning on Stripe email receipts in the dashboard.

### Step 6: Admin + first deploy · ~5–6 days

**Admin:**
1. **Admin login:** Better Auth with **2FA required** for `role = admin`. Every admin page and admin API checks this on the server.
2. **Orders:**
   - List with status tabs and search by number or email.
   - Order page shows items, measurements, address, payment link to Stripe, and the timeline.
   - Buttons only for allowed moves. "Shipped" asks for courier and tracking number, then sends the email.
   - Internal notes.
   - "Resend confirmation email".
3. **Products:**
   - List with status. Add/edit form with all fields, sizes and stock, and photo upload straight to R2 with alt text required.
   - Publish or unpublish. Saving refreshes the shop pages.
4. **Dashboard:** orders and revenue (today, week, month), orders waiting in each status, low-stock sizes.
5. **Admin log:** every admin change writes `admin_log` (before/after).

**First deploy (staging):** follow section 9. **Start the Google Cloud trial only now** (the 90-day clock starts at sign-up). Use Stripe **test mode** on staging.

**Done when:**
- You can add a product with photos in admin and see it live in the shop.
- A test order goes Paid → Confirmed → In production → Shipped (email received) → Delivered.
- A refund in Stripe's dashboard turns the order to Refunded.
- A non-admin can't open `/admin`, even by typing the URL.
- Staging works over HTTPS.

### Step 7: Accounts, custom fit and order status · ~5 days
1. **Login** (`/login`):
   - Email → a 6-digit code by email, or "Continue with Google".
   - Turnstile and rate limits stop abuse.
   - No passwords to forget.
2. **Account** (`/account`):
   - Orders list: all orders with the same verified email, including guest orders.
   - Order details.
   - Saved measurements (fit profiles): add, edit, delete.
3. **Order status page** (`/orders/[number]?t=[token]`):
   - Opened from the email link; works without logging in.
   - Shows the timeline, items, measurements (read-only), tracking link and the fit-call button.
4. **Custom-fit form** (opened from the product page):
   - Sections for the tailor's measurement list, with an inch/cm switch.
   - A diagram showing where to measure, and range checks with clear errors.
   - Works fully by keyboard: focus stays inside while open and returns afterwards.
   - Signed-in customers can **load or save a fit profile**. Guests can still enter measurements.
   - The measurements travel with the bag item and are copied into the order.
5. **Fit calls:**
   - The confirmation email and order page link to your **Cal.com** booking page, with the order number filled in.
   - Cal.com emails you when someone books.
   - After the call, you move the order to `confirmed` and edit the measurements if needed (logged).
6. **Daily reminder job:** if a custom-fit order has no fit call booked 2 days after payment, email the customer a reminder (once).
7. **Analytics:** `measurement_started`, `measurement_completed`, `login`, `sign_up`.

**Done when:**
- Email-code and Google login work.
- A guest's past orders appear after they log in with the same email.
- A custom-fit order carries the exact measurements into admin.
- The measurement form passes a keyboard-only test and an axe check.

### Step 8: PWA and polish · ~3 days
1. **PWA:**
   - `app/manifest.ts` with name, short name, icons (192, 512, maskable), `display: standalone`, and Virasat theme colours.
   - Apple touch icon.
   - A simple offline page.
   - **Never cache** bag, checkout, account or admin pages.
2. **Info pages:** about, size guide, shipping & returns, privacy, terms, and a contact form (Turnstile, sends to your email).
3. Loading, empty and error states on every page, plus custom 404 and 500 pages.
4. Cookie and analytics notice: use PostHog's cookieless mode, or a simple banner.

**Done when:**
- The site installs on Android ("Install app") and iPhone ("Add to Home Screen") and opens full-screen.
- Chrome DevTools shows no manifest errors.
- Every page has its loading, empty and error states.

### Step 9: Launch checks and go live · ~3 days
Work through the launch checklist (section 10). Switch Stripe to **live mode**. **Upgrade Google Cloud to paid** (unused trial credit still applies until day 90). Ship the test parcels.

**Done when:** the checklist is complete and the first real order has gone all the way to "Delivered".

**Total:** about **6 weeks** of build time, with Step 0 running alongside.

---

## 9. Hosting on Google Cloud

1. **Account and budget:**
   - Sign up (card needed) and create a project.
   - Budget alerts at ₹100, ₹4,000 and ₹8,000.
2. **Server:**
   - Compute Engine **e2-medium** (2 vCPU, 4 GB RAM), **Ubuntu 24.04 LTS**, 30 GB disk.
   - US region (e.g. `us-east1`). Reserve a **static IP**.
3. **Firewall:** ports 80 and 443 open. SSH (22) only from your IP or through Google's IAP.
4. **Server setup:**
   - Docker + Compose plugin, a **2 GB swap file**, automatic security updates.
   - Note: Google Cloud blocks outgoing email port 25. We send through Resend's HTTPS API, so this doesn't matter.
5. **`docker-compose.prod.yml`:**
   - `caddy` (ports 80/443)
   - `web` (Next.js `standalone` build)
   - `postgres` (data on a named volume, not exposed to the internet)
6. **Domains (Cloudflare):**
   - `www.<domain>` → the app (the bare domain redirects to www).
   - `images.<domain>` → the R2 bucket.
   - SSL mode **Full (strict)**.
7. **Secrets:**
   - A `.env` file on the server only (`chmod 600`): database password, Better Auth secret, Stripe keys and webhook secret, Resend key, R2 keys, Google login keys, Sentry and PostHog keys.
8. **Deploy script:** `git pull` → `docker compose build` → `prisma migrate deploy` → `docker compose up -d`.
9. **Stripe webhook** pointed at `https://www.<domain>/api/stripe/webhook`.
10. **Scheduled jobs** (Linux cron on the server, calling protected `/api/cron/*` routes with a secret header):
    - Every hour: resend failed emails (`/api/cron/emails`).
    - Daily: fit-call reminders.
    - Daily: delete checkout drafts older than 7 days (`/api/cron/drafts`).
11. **Backups:**
    - Nightly `pg_dump` → a Google Cloud Storage bucket, kept for 30 days.
    - Weekly disk snapshot.
    - **Restore once** to prove it works.
12. **Monitoring:** Sentry alerts by email, and a free uptime monitor (UptimeRobot or Better Stack) on the home page.

**After the trial:** about ₹2,500–3,000/month. If memory stays above 80%, move to an 8 GB server.

---

## 10. Launch checklist

- [ ] US duty rate confirmed by the broker; every price includes duty, shipping and fees
- [ ] Stripe **live mode**, live webhook set, one real low-value order paid and refunded
- [ ] Courier account live, test parcels delivered with **no fees for the receiver**, duty bill matches the price sheet
- [ ] Policies published (shipping, returns, custom fit, privacy, terms); contact details visible
- [ ] Lighthouse and axe pass on home, category, product, bag and account; tested at 360px
- [ ] Measurement form tested with the tailor on 3 real people
- [ ] Emails reach Gmail and Outlook inboxes (not spam)
- [ ] Admin 2FA on; only the people who need it are admins
- [ ] Backups running, **restore tested**
- [ ] Sentry and uptime alerts reach your email
- [ ] Test products and test orders removed; real stock entered
- [ ] Sitemap submitted to Google Search Console
- [ ] Google Cloud upgraded to paid, budget alerts on
- [ ] One-page ops guide written: how to process an order, ship, refund, issue store credit, and what to do if the site is down

---

## 11. Plan review: risks and how we handle them

| # | Risk | Why it matters | What we do |
|---|---|---|---|
| **R1** | **US import duty may be very high** | In 2025 the US raised tariffs on many Indian goods to as much as 50%, on top of normal clothing duty. Today's rate is unknown. This can make prices uncompetitive | Get the rate from a broker **before** building prices (Step 0). If it's too high, test in India first or in another country |
| **R2** | **Two companies means paperwork** | Export papers, US company paying the Indian company, US import rules | CA sets this up in Step 0, before the first real sale |
| **R3** | **Stripe US account approval** | Stripe may ask for extra details for a US company with Indian founders | Apply in week 1. Build in test mode meanwhile. Backup: Razorpay international through the Indian company (≈ ₹998 per $300 order) |
| **R4** | **Our code, our bugs** | Payment and order mistakes cost money and trust | Stripe handles payments; prices come only from our database; orders only come from verified webhooks; tests for money and order rules |
| **R5** | **One server** | If it fails, the shop is down | Nightly backups, weekly snapshots, a tested restore, written rebuild steps. Fine for a prototype |
| **R6** | **Manual operations** | Booking labels and updating statuses by hand takes time | Fine up to about 10–20 orders a day. Automate labels after that |
| **R7** | **Measurement mistakes** | Wrong measurements mean alteration costs and unhappy customers | Tailor-approved ranges, how-to-measure diagrams, a fit call before production |
| **R8** | **Late deliveries** | US rules require telling the customer and offering a refund if we miss the promised date | Conservative date ranges with a buffer |
| **R9** | **Overselling the last item** | Two people buying the last piece at the same moment | Very rare at prototype volume. Stock is checked at checkout and reduced in the webhook. If it happens, refund and apologise |
| **R10** | **Emails in spam** | Customers miss their confirmation | SPF, DKIM and DMARC; test inboxes before launch |
| **R11** | **Scope creep** | Adding "just one more feature" delays the market test | Anything not in section 2 waits until after launch |
| **R12** | **Photos and content** | A premium design with weak photos still looks cheap | Plan the photoshoot in Step 0, in parallel with the build |

### Still to find out (Step 0)
1. Current US duty rate for each product type.
2. Stripe account approval for the US company.
3. Courier quotes (DHL Express vs an aggregator) for 2–3 kg parcels with duties paid by us.
4. The tailor's measurement list and ranges.
5. Whether Stripe Checkout offers PayPal for your US account. If not, add PayPal's own buttons after launch.

---

## 12. After the prototype

Do these only once sales data shows demand, roughly in this order:

1. **PayPal** (if customers ask).
2. **India** through the Indian company: Razorpay (UPI, cards; new merchants currently get 90 days at 0% fee), domestic courier, cash-on-delivery with SMS OTP (MSG91, ≈ ₹0.15–0.25 per SMS).
3. **Canada and the UK:** separate prices per country (with `/us`, `/ca` style URLs).
4. **Automatic shipping labels and tracking** through the courier's API.
5. **Wishlist, reviews, discount campaigns.**
6. **WhatsApp/SMS order updates** and PWA push notifications.
7. **Native app** (Capacitor) once customers buy again and again.
8. **Bigger platform:** move toward `virasat-build-spec.md` when one server and manual operations are no longer enough.
