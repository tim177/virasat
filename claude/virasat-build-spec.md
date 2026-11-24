# Virasat — Build Spec & Prompt Pack

> **Status (24 Nov 2026): long-term reference for v2 and later.** The v1 prototype is built from `virasat-v1-launch-spec.md` (our own Next.js + Postgres app with Stripe Checkout, US only, duties-included pricing). Use this document when v1 data says it's time to scale.

**What this is:** everything an engineer (or an AI coding agent) needs to build Virasat — a premium, cross-border e-commerce platform for Indian traditional wear — from the approved Design canvas, with a system design that scales from launch to Myntra-style sale days.

**Version:** 1.0 · 13 Nov 2026
**Design source of truth:** Virasat Design canvas (boards 00–17 shopping & account, 18–22 storefront additions, 23–32 admin, plus shared components).

---

## 0. How to use this document

1. **Part A is the master prompt.** Save it at the repo root as `CLAUDE.md` / `AGENTS.md` / `.cursorrules`, or paste it at the start of every coding session. It sets the stack, the rules and the definition of done.
2. **Parts B–H are the reference spec.** The agent reads the section relevant to the task in hand.
3. **Part I is a sequence of phase prompts.** Run them one at a time, in order, and review each phase before starting the next.

**Blunt truth:** asking any agent to "build the whole Myntra-like site" in one prompt gets you a shallow skeleton that collapses at checkout. Build it in phases, with tests, and keep the money and order logic boring and correct.

---

## Part A — Master prompt (paste this)

```text
You are a senior full-stack engineer and product designer building "Virasat", a premium
cross-border e-commerce platform that sells Indian traditional wear (lehengas, sarees,
sherwanis, anarkalis, kurta sets) to customers worldwide, with made-to-measure tailoring.
Markets at launch: US, UK, EU (DE first), CA, AU, AE, IN.

PRODUCT PILLARS
1. Luxury editorial storefront that converts (clean, fast, accessible).
2. Prices, duties and delivery dates are explicit and local to the shopper's market.
3. Made-to-measure (MTM): measurement profiles, fit calls, a production pipeline.
4. Self-service account: orders, tracking, returns/alterations, wishlist, fit profiles.
5. A back office (admin) that runs catalog, orders, production, returns, promotions, CMS,
   markets, and staff permissions.

STACK (do not substitute without asking)
- Monorepo: pnpm + Turborepo. TypeScript strict everywhere.
- apps/storefront: Next.js (App Router, React Server Components), Tailwind CSS with design
  tokens from packages/ui, next/image, next-intl for i18n.
- apps/admin: Next.js (App Router), same UI package, TanStack Table, React Hook Form + Zod.
- apps/api: NestJS modular monolith (REST + OpenAPI). Prisma ORM on PostgreSQL 16.
- packages/ui (design system components), packages/contracts (Zod schemas + generated
  OpenAPI client), packages/config (eslint, tsconfig).
- Redis (cache, cart, rate limits, BullMQ job queues). OpenSearch or Typesense for search.
- S3 + CloudFront for media; Postgres read replica for admin reporting.
- Payments behind a PaymentProvider interface (Stripe and/or Adyen/Checkout.com for global
  cards, Apple Pay, Google Pay, Klarna, Afterpay; PayPal; Razorpay for India/UPI).
- Shipping behind a CarrierProvider interface (DHL Express first). Landed cost behind a
  DutyProvider interface (internal tables v1, Zonos/Avalara/Global-e later).

NON-NEGOTIABLE RULES
1. Money: store integer minor units + ISO 4217 currency. Never floats. Never convert at
   display time from a single base price - use per-market price books. Snapshot price,
   currency, FX rate and duty on every order line.
2. Orders follow an explicit state machine (see spec E6). No ad-hoc status strings.
3. Every write endpoint that creates money movement or orders takes an Idempotency-Key.
4. Cross-module side effects go through the transactional outbox -> queue. No direct calls
   from Orders into Notifications/Search.
5. Accessibility: WCAG 2.2 AA. Real <button>/<a>/<label>, 44px targets, 4.5:1 contrast,
   visible focus, keyboard-complete flows including the measurement modal and filters.
6. Performance budgets (p75, mobile): LCP < 2.5s, INP < 200ms, CLS < 0.1. PLP/PDP are
   server-rendered and CDN-cached per market.
7. Security: RBAC on every admin route and API; audit log for every admin write; 2FA for
   staff; no card data touches our servers (hosted fields only); secrets in AWS Secrets
   Manager; OWASP ASVS L2.
8. Every feature ships with: Zod-validated contracts, unit tests for domain logic,
   an API integration test, a Playwright e2e for the happy path, loading/empty/error
   states, analytics events, and i18n-ready strings.

DESIGN SYSTEM (match the Virasat canvas exactly)
- Colours: Crimson 700 #7B1E2B (primary action), Crimson 800 #5E1520 (hover), Crimson 50
  #FAF0F0; Emerald 700 #0F4C3A (trust/success), Emerald 100 #DCEBE4; Gold 500 #C9A45C
  (ornament only), Gold 700 #8A6A2B (only gold allowed as text on light), Gold 400 #D9B46A
  (CTA on dark); Charcoal #1F1B19 (text), Stone 700 #5F5751 (secondary text), Line #E6DED1,
  Sand #F3EDE3, Ivory #FBF8F3 (page ground), White (surfaces). Error #B42318,
  Warning #9A5B00, Info #1F4E79.
- Type: Playfair Display (display/headings, 400-600, italic for emphasis), Inter (UI/body).
  Scale: 72/56/40/32/24 display & headings; 18/16/14/12 body. Prices use tabular figures.
- Radius: 2px cards/images, 6px inputs/modals, 999px pills, "arch" (999 999 2 2) for
  category/lookbook frames. Elevation: two shadow levels only.
- Motifs: "zari rule" divider (1px gold line + diamond knot), jaali lattice texture for
  image placeholders and photo-free surfaces. No gradients-as-decoration, no emoji.
- Layout: 1360px max content width, 12-col grid, 24px gutter, 16px mobile gutter.

WORKING STYLE
- Before coding a feature, restate the acceptance criteria and list files you will touch.
- Small PRs per feature. Conventional commits. Update docs/adr when a decision changes.
- If a requirement is ambiguous, propose the simplest option that keeps the rules above
  and note it in the PR description.
```

---

## Part B — Product scope

### B1. Who it's for

| Persona | Needs | Screens that serve them |
|---|---|---|
| Diaspora shopper (US/UK/CA/AU/UAE) | Trust, local prices, no customs surprises, firm delivery dates | Home, PLP, PDP, Bag, Checkout, Tracking |
| Bride + family planner | Coordinated outfits, shared decisions, fit confidence, deadline safety | Wishlist boards + sharing, Fit profiles, Video styling, "next big occasion" date |
| Gift buyer | Ship to India or abroad, gift wrap, hidden prices | Addresses, Gift box, Gift cards |
| India domestic shopper | UPI/COD, fast delivery, INR prices incl. GST | Same flows, market = IN |
| Ops / CS / catalog / production / marketing / finance staff | Run the business safely | Admin back office |
| Designer / atelier partner (phase 4) | List products, fulfil orders, get paid | Seller portal |

### B2. Sitemap

```
STOREFRONT (/{market}/{lang}/…, e.g. /us/en/…)
├─ Home
├─ Search  (autocomplete overlay + results page)
├─ Category / PLP  (/lehengas, /sarees, /men/sherwanis, /occasions/wedding …)
├─ Collection & Lookbook  (/edit/udaipur)
├─ Designer store  (/designers/{slug})
├─ Sale / Offers event  (/sale/festive-2026)
├─ PDP  (/p/{slug}-{sku})  ── Measurement modal ── Reviews (/p/{slug}/reviews)
├─ Bag → Checkout (address → delivery → payment) → Confirmation
├─ Auth  (sign in, sign up, OTP, forgot password, social)
├─ Help centre  (guest order lookup, FAQ, contact)
├─ Rewards & referrals  (Virasat Circle)
├─ Gift cards
└─ System: 404, 500, maintenance, cookie consent, market-switch interstitial

ACCOUNT (/account/…)
├─ Overview & profile      ├─ Fit profiles + fit-call booking
├─ Orders → Order detail/tracking   ├─ Addresses, payment methods, store credit
├─ Returns & alterations   ├─ Settings (region, notifications, security, privacy)
├─ Wishlist (boards, share) └─ Notifications inbox

ADMIN (admin.virasat.com)
├─ Dashboard               ├─ Customers (CRM, segments, notes)
├─ Orders (OMS)            ├─ Promotions (coupons, sale events, gift cards)
├─ Catalog: products, product editor, categories, attributes, designers
├─ Inventory & warehouses  ├─ Content (CMS: homepage, banners, lookbooks)
├─ Production (MTM board)  ├─ Reviews moderation
├─ Returns & refunds       ├─ Reports & exports
└─ Settings: markets, currencies & FX, duties & tax, shipping methods, payments,
   staff & roles, audit log, integrations

SELLER PORTAL (phase 4, seller.virasat.com): products, orders to fulfil, payouts, performance.
```

---

## Part C — Design system implementation

- **Tokens as code:** `packages/ui/tokens.ts` exports colours, type scale, spacing (4/8/12/16/24/32/48/64/96), radii, shadows. Tailwind config reads from it. Never hard-code a hex in a component.
- **Core components (build in Storybook first):** Button (primary/secondary/gold/link, sizes, loading), IconButton, Input/Select/Textarea with label + help + error, PhoneInput (country code), AddressAutocomplete, Checkbox/Radio/Switch, Chip/FilterChip, Badge, Price (currency-aware, strike, % off, tabular), ProductCard, Gallery, Accordion, Tabs, Stepper, Modal/Drawer, Toast, Breadcrumbs, Pagination/LoadMore, EmptyState, Skeleton, DataTable (admin), StatTile (admin), StatusPill, Timeline (tracking), Kanban (production).
- **Market context:** a `MarketProvider` exposes `{country, currency, locale, dutyMode, units}`. Every price, date and address label reads from it. Switching market writes a cookie and navigates to the market URL.
- **Image placeholders:** keep the jaali texture as the loading placeholder (blur-up from a 16px LQIP).
- **Accessibility tests:** axe-core in Playwright on every page. Storybook a11y addon on every component.
- **Motion:** 150–250ms ease-out for overlays. Respect `prefers-reduced-motion`.

---

## Part D — Screen specs and acceptance criteria

Each screen matches its canvas board. Every screen has loading, empty and error states and works at 360px width.

### Storefront

| Screen | Must do | Acceptance criteria |
|---|---|---|
| Home | CMS-driven sections: hero, trust strip, categories (arches), occasions, trending, lookbooks, shipping banner | All sections come from CMS JSON; hero LCP image preloaded; trending is personalised when signed in, else bestsellers per market |
| Search | Autocomplete (queries, categories, products, designers), typo tolerance, synonyms (e.g. "ghagra" → lehenga), recent searches, results with the PLP filters | Suggestions < 100ms p95; zero-result page offers related queries + stylist chat; search terms logged for merchandising |
| PLP | Server-rendered grid; facets: stitching type, fabric, work, price (market currency), colour, size, occasion, delivery speed; sort; density toggle | Facet counts are accurate after every selection; URL reflects filters (shareable, crawlable canonical); 24 items per page + "load more" |
| PDP | Gallery + video, variant/colour, stitching options with price deltas, size or custom measurement, delivery-date calculator by postcode, specs, care, reviews summary, complete the look | Price shows currency + duty mode; delivery dates come from the API (production days + carrier transit); Add to bag disabled until required choices are made, with an inline reason |
| Measurement modal | 4 steps: blouse design → blouse measurements → lehenga measurements → review/save profile; in/cm; figure highlights the active field | Validates ranges per field; saving creates a FitProfile; works fully by keyboard; focus is trapped and restored |
| Reviews | Rating distribution, fit feedback ("runs small / true / large"), photo reviews, filters, verified-buyer badge, write-review form | Only delivered orders can review; photos moderated before publishing; helpful votes rate-limited |
| Designer store | Designer story, filters within their catalog, follow designer | Follow creates a notification preference |
| Sale / offers | Countdown, tiered offers, coupons with copy/apply, bank/payment offers, early access for members | Countdown is server-time based; coupons validated server-side; the page survives 10× normal traffic from CDN |
| Bag | Line items with customisation summary, qty, move to wishlist, gift box, promo codes, duty line, delivery estimate | Totals recalculate server-side on every change; promo errors are specific ("min order £400"); stock re-checked |
| Checkout | Accordion: address (autocomplete, local formats) → shipping method (dates) → payment (cards, wallets, BNPL, PayPal, UPI for IN); order summary | Guest checkout allowed; address validated; payment via hosted fields; idempotent "Place order"; 3-D Secure handled |
| Confirmation | Order ID, invoice PDF, milestone tracker, next steps (fit call) | Reached only by redirect from a successful payment; refresh-safe |
| Rewards | Tier status (Silver/Gold/Heritage), points balance + history, earn/burn rules, referral link | Points ledger is append-only; referral reward granted after the referee's order passes the return window |
| Help centre | Search, guest order lookup, topics, FAQ, contact channels, contact form | Lookup needs order number + email/phone; rate-limited |

### Account

| Screen | Must do | Acceptance criteria |
|---|---|---|
| Overview | Active orders first, "action needed" (book fit call), tiles to every account feature, recently viewed | All tiles show live counts |
| Orders | Tabs by status, search, per-order actions (track, invoice, buy again, return, cancel within window) | Cancel only allowed before production starts; buy again keeps customisations |
| Order tracking | The 6 Baymard details: delivery date, progress bar, carrier, linked tracking number, shipping history, package contents; change-delivery options | Carrier events ingested by webhook; times shown in the user's time zone |
| Returns | Select items → reason + photos → exchange / store credit (+bonus) / refund + pickup or drop-off → review → QR label | Eligibility computed server-side (window, MTM excluded → alteration flow); refund amount preview matches final |
| Wishlist | Boards, share link with comments, price-drop / back-in-stock alerts, move to bag | Alerts fire through the Notifications service, respecting preferences |
| Fit profiles | CRUD profiles for self + family, set default, book fit call slots in local time | Slots come from tailor calendars in IST, shown in the user's time zone |
| Addresses & payments | Address book, default, saved payment tokens, store credit, gift-card redeem | Saved cards are provider tokens only |
| Settings | Market/currency/language/units, notification matrix, password, 2FA, linked logins, sessions, data export/delete | Account delete is a soft delete + anonymisation job; order records are kept |

### Admin

See Part F.

---

## Part E — System design

### E1. Architecture at a glance

```
                     ┌──────────────── CloudFront CDN (per-market cache keys) ─────────────────┐
 Shoppers ──HTTPS──► │  storefront (Next.js, ISR/RSC)        admin (Next.js, no CDN cache)      │
                     └──────────────┬──────────────────────────────────┬────────────────────────┘
                                    │ REST (OpenAPI)                   │ REST + RBAC
                             ┌──────▼──────────────────────────────────▼──────┐
                             │            API — NestJS modular monolith        │
                             │ identity · catalog · pricing/markets · inventory│
                             │ cart · checkout · orders · payments · shipping  │
                             │ production(MTM) · returns · promotions · reviews│
                             │ wishlist · cms · loyalty · notifications · admin│
                             └──┬─────────┬──────────┬───────────┬────────────┘
                                │         │          │           │ outbox
                         ┌──────▼──┐ ┌────▼───┐ ┌────▼─────┐ ┌───▼──────────┐
                         │Postgres │ │ Redis  │ │OpenSearch│ │ SQS / BullMQ │──► workers:
                         │+replica │ │cache,  │ │/Typesense│ │   queues     │   indexer, email/SMS/
                         └─────────┘ │cart,RL │ └──────────┘ └──────────────┘   WhatsApp, carrier sync,
                                     └────────┘                                 FX refresh, reports
 External: payment providers · DHL/carrier APIs · duty/tax engine · FX rates · email (SES/Postmark)
           · WhatsApp (Meta Cloud API) · S3 media · analytics (PostHog/GA4) · data lake (S3 + Athena)
```

### E2. Why a modular monolith first

- One deployable API with **strict module boundaries**: each module owns its tables, exposes a service interface, and publishes domain events. Modules never touch each other's tables.
- **Blunt:** microservices on day one buys you distributed-transaction bugs, five pipelines and a bigger AWS bill, with no customers yet to justify it. Myntra-scale traffic is not your launch problem. Correct money and order logic is.
- **Extraction path:** when a module has its own scaling profile, it becomes a service behind the same interface, fed by the same events. Likely order: Search (already separate infra) → Notifications → Pricing/Promotions (sale-day load) → Catalog read model.

### E3. Module map

| Module | Owns | Publishes events | Consumes |
|---|---|---|---|
| identity | users, sessions, staff, roles, permissions | UserRegistered | — |
| catalog | products, variants, media, attributes, categories, collections, designers | ProductPublished/Updated | — |
| pricing & markets | markets, price_books, prices, fx_rates, duty_rules, tax_rules | PriceChanged | ProductPublished |
| inventory | warehouses, stock_levels, reservations | StockLow, StockChanged | OrderPlaced, OrderCancelled |
| cart | carts, cart_items (Redis + Postgres for signed-in users) | — | PriceChanged |
| checkout | checkout sessions, quotes (landed cost) | — | — |
| orders (OMS) | orders, order_items, status history | OrderPlaced, OrderStatusChanged | PaymentCaptured, ShipmentEvent, ProductionStageChanged |
| payments | payment_intents, payments, refunds, payment_methods (tokens) | PaymentAuthorized/Captured/Failed, RefundIssued | ReturnApproved |
| shipping | shipments, tracking_events, carrier accounts | ShipmentCreated, ShipmentEvent | OrderReadyToShip |
| production (MTM) | production_jobs, stages, fit_calls, tailor calendars | ProductionStageChanged, FitCallBooked | OrderPlaced (MTM lines) |
| returns | rmas, rma_items, alteration_requests | ReturnRequested/Received/Approved | ShipmentEvent |
| promotions | coupons, promotions, sale_events, gift_cards | — | OrderPlaced (redemptions) |
| reviews | reviews, review_media, votes | ReviewPublished | OrderDelivered |
| wishlist | boards, items, shares, comments, alerts | — | PriceChanged, StockChanged |
| loyalty | tiers, points_ledger, referrals | PointsEarned | OrderDelivered, ReturnApproved |
| cms | pages, sections, banners, lookbooks (versioned JSON) | ContentPublished | — |
| notifications | templates, preferences, deliveries | — | almost everything |
| audit | audit_log (append-only) | — | all admin writes |

### E4. Core data model (Postgres)

All tables have `id uuid pk`, `created_at`, `updated_at`; money is `amount_minor bigint` + `currency char(3)`.

```
markets(code pk 'US', name, currency, locale, duty_mode 'DDP'|'DDU', tax_inclusive bool,
        default_carrier, active)
fx_rates(base, quote, rate numeric(18,8), source, as_of)        -- audit only; prices come from price books
price_books(id, market_code, name, valid_from, valid_to, rounding_rule)
prices(price_book_id, variant_id, amount_minor, compare_at_minor)   unique(price_book_id, variant_id)
duty_rules(market_code, hs_code_prefix, duty_rate, vat_rate, threshold_minor, notes, valid_from)

designers(id, slug, name, story, region, commission_rate, status)
categories(id, parent_id, slug, path ltree, name_i18n jsonb)
attributes(code 'fabric'|'work'|'occasion'|'stitching'|'colour', values jsonb)
products(id, slug, designer_id, category_id, title_i18n, description_i18n, hs_code,
         status 'draft'|'published'|'archived', attributes jsonb, care jsonb, seo jsonb)
product_variants(id, product_id, sku unique, colour, size, stitching 'unstitched'|'semi'|'ready'|'mtm',
                 weight_g, production_days, barcode)
product_media(id, product_id, url, kind 'image'|'video', alt_i18n, position, variant_colour)
customisation_options(id, product_id, code 'blouse_neck_front'…, choices jsonb, price_delta_minor_by_market jsonb)

warehouses(id, code 'JAI', country, address)
stock_levels(variant_id, warehouse_id, on_hand, reserved, safety_stock)
reservations(id, variant_id, warehouse_id, qty, cart_or_order_id, expires_at)

users(id, email citext unique, phone_e164, name, locale, market_code, marketing_opt_in, deleted_at)
addresses(id, user_id, label, name, line1, line2, city, region, postal_code, country, phone_e164, is_default)
fit_profiles(id, user_id, name, for_person, kind 'blouse_lehenga'|'menswear'|'anarkali',
             measurements jsonb, units 'in'|'cm', design_prefs jsonb, verified_by_staff_id, verified_at)

carts(id, user_id null, anon_token, market_code, currency, updated_at)
cart_items(id, cart_id, variant_id, qty, customisation jsonb, fit_profile_id, unit_price_minor)

orders(id, number 'VRS-YYMMDD-NNNN' unique, user_id, email, market_code, currency,
       status (state machine), subtotal_minor, addons_minor, shipping_minor, duty_minor, tax_minor,
       discount_minor, total_minor, fx_rate_to_usd, duty_mode, shipping_address jsonb,
       billing_address jsonb, placed_at, idempotency_key unique)
order_items(id, order_id, variant_id, sku, title_snapshot, qty, unit_price_minor, addons_minor,
            customisation jsonb, measurements_snapshot jsonb, production_job_id, status)
order_status_history(order_id, from_status, to_status, actor, reason, at)

payment_intents(id, order_id, provider, provider_ref, amount_minor, currency, status, method)
refunds(id, payment_intent_id, amount_minor, reason, provider_ref, status)
saved_payment_methods(id, user_id, provider, token, brand, last4, exp_month, exp_year)

shipments(id, order_id, carrier, service, tracking_number, label_url, status, eta_from, eta_to)
tracking_events(shipment_id, code, description, location, occurred_at, raw jsonb)

production_jobs(id, order_item_id, stage, tailor_id, karigar_unit, due_at, sla_breach_at, notes)
production_stage_log(job_id, stage, by_staff_id, photos jsonb, at)
fit_calls(id, order_id, fit_profile_id, slot_start_utc, staff_id, status, recording_consent)

rmas(id, number, order_id, user_id, kind 'return'|'exchange'|'alteration', status, resolution
     'refund'|'store_credit'|'exchange', method 'pickup'|'dropoff', qr_code, label_url)
rma_items(rma_id, order_item_id, qty, reason_code, comment, photos jsonb, inspection_result)

coupons(code pk, promotion_id, usage_limit, per_user_limit, used_count)
promotions(id, name, kind 'percent'|'fixed'|'bxgy'|'free_shipping'|'tiered', rules jsonb,
           markets text[], starts_at, ends_at, stackable, priority)
gift_cards(id, code_hash, initial_minor, balance_minor, currency, expires_at)
store_credit_ledger(id, user_id, delta_minor, currency, reason, ref_id)   -- append-only

reviews(id, product_id, order_item_id, user_id, rating 1..5, fit 'small'|'true'|'large', title,
        body, status 'pending'|'published'|'rejected', helpful_count)
wishlist_boards(id, user_id, name, share_token, comments_enabled)
wishlist_items(board_id, product_id, variant_id, saved_price_minor, saved_currency)
loyalty_accounts(user_id, tier, points_balance) ; points_ledger(id, user_id, delta, reason, ref_id, expires_at)
referrals(id, referrer_id, referee_id, code, status, rewarded_at)

cms_documents(id, kind 'home'|'page'|'banner'|'lookbook', market_codes text[], locale,
              version, status 'draft'|'scheduled'|'live', publish_at, body jsonb)
notifications(id, user_id, channel, template, payload jsonb, status, sent_at)
notification_prefs(user_id, topic, channel, enabled)
staff(id, email, name, role_ids uuid[], mfa_enabled, last_login_at)
roles(id, name) ; role_permissions(role_id, permission 'orders:refund'…)
audit_log(id, actor_staff_id, action, entity, entity_id, before jsonb, after jsonb, ip, at)
outbox(id, aggregate, event_type, payload jsonb, created_at, published_at)
```

Indexes that matter on day one: `orders(user_id, placed_at desc)`, `orders(status, placed_at)`, `order_items(production_job_id)`, `prices(price_book_id, variant_id)`, `stock_levels(variant_id)`, `products(status, category_id)`, `tracking_events(shipment_id, occurred_at)`, and a GIN index on `products.attributes`.

### E5. Markets, money, duties: the part that makes or breaks trust

1. **Market resolution:** URL prefix (`/us/en`) wins, then cookie, then geo-IP suggestion (a banner, never a forced redirect). The market fixes currency, locale, duty mode, units and the price book.
2. **Price books per market, not live FX conversion.** Merchandisers set `$1,240 / £980 / €1,150 / ₹1,04,000` as deliberate, "charm-rounded" prices. A nightly FX job flags drift over ±3% for review. Live conversion makes prices jitter daily and looks cheap.
3. **Landed cost at quote time:** `duty = Σ(line value × duty_rate(hs_code, market))`, `import VAT/GST = (value + duty + shipping) × vat_rate`. Under DDP we collect it at checkout and pay it through the carrier's duty account.
   - **US:** the $800 de minimis exemption is suspended for goods from every country, so every US parcel now goes through entry and may owe duties. DDP is mandatory for a good experience.
   - **UK:** the seller collects VAT at checkout on consignments of £135 or less.
   - **EU:** use IOSS for consignments of €150 or less.
   - **Your job:** confirm current thresholds and HS-code rates with a licensed customs broker before launch. Build `duty_rules` to be data-driven, so a rule change is a data edit, not a deploy.
4. **Snapshots:** an order stores unit prices, duty, tax, FX-to-USD and the price book ID. A refund is computed from the snapshot, never from today's prices.
5. **Rounding:** compute in minor units with banker's rounding per line. Display through `Intl.NumberFormat(locale, {currency})`.

### E6. Order state machine

```
              ┌─────────── cancel (before production/pack) ───────────┐
              ▼                                                       │
pending_payment ──payment_authorized──► placed ──► (MTM lines?) ──yes─► awaiting_fit_call ─► in_production ─► qc
     │                                     │                                                              │
 payment_failed                            no                                                             ▼
                                           └──────────────────────────────────────────────────────► ready_to_ship
ready_to_ship ─► shipped ─► in_transit ─► customs_cleared ─► out_for_delivery ─► delivered ─► completed (window closed)
                                                                                    │
                                                    return_requested ◄──────────────┘ ─► return_received ─► refunded / exchanged
```

- Order status is derived from item statuses where items move independently (split shipments).
- Transitions live in one `OrderStateMachine` service with guards (e.g. can't ship with unpaid balance) and write `order_status_history` + outbox events in the same transaction.
- **Capture policy:** authorise at checkout; capture on dispatch for ready-to-wear; capture at "production started" for MTM. Card authorisations expire in about 7 days, so MTM needs capture at start or a re-auth flow.

### E7. Made-to-measure pipeline (your differentiator; most competitors do this badly)

```
OrderPlaced(MTM line)
  └─► production_job created (stage = awaiting_fit_call, due_at = placed_at + SLA)
        └─► customer books fit call (slots from tailor calendars, stored UTC, shown local)
              └─► fit call done → measurements verified (snapshot locked)
                    └─► cutting → embroidery/karigar unit → stitching → QC (photos uploaded)
                          └─► customer approves photos (optional, 48h auto-approve)
                                └─► ready_to_ship → shipping module creates shipment + label
SLA engine: every stage has a target duration; jobs at risk of missing the promised
delivery date surface on the admin dashboard and production board 48h ahead.
```

### E8. Checkout & payment sequence

```
Browser            Storefront           API(checkout)          PaymentProvider      Outbox/Workers
  │ Place order ──►  │ POST /checkout/{id}/confirm  (Idempotency-Key)
  │                  │ ───────────────►  re-price cart, re-check stock, reserve stock (TTL 15m)
  │                  │                   create order(pending_payment) + payment_intent
  │                  │ ◄─── client_secret ─┤
  │ hosted fields / wallet / 3DS ─────────────────────────────►│
  │                                         ◄── webhook payment_intent.succeeded (signed)
  │                                         order → placed, reservation → committed,
  │                                         outbox: OrderPlaced ───────────────────────► email/WhatsApp,
  │ ◄── redirect /confirmation?order=…                                                   production jobs,
                                                                                         analytics, search stock
```

- The **webhook is the source of truth**, not the browser redirect. The confirmation page polls the order status.
- **Idempotency:** `(user, idempotency_key)` is unique. Retries return the same order.
- **Payments by market:**
  - Global cards, Apple Pay, Google Pay, Klarna, Afterpay/Clearpay: Stripe, Adyen or Checkout.com.
  - PayPal: direct integration or via Braintree.
  - India (UPI, RuPay, netbanking, COD if you offer it): Razorpay.
- **Stripe warning:** new Stripe accounts for Indian businesses are invite-only. If you are an Indian entity, your options are:
  - request an invite through Stripe Sales;
  - use Adyen, Checkout.com, or PayPal plus a cross-border gateway;
  - set up a foreign entity, which carries real tax and compliance overhead.

  Keep payments behind an interface so you can switch providers.

### E9. Inventory

- Ready-to-wear: on-hand per warehouse; reservations with a 15-minute TTL at checkout, released by a sweeper job.
- MTM and unstitched: "made to order" capacity instead of stock — `production_capacity(week, unit, slots)`. Checkout reserves a capacity slot, which also drives the promised date.
- Low-stock and oversell alerts go to the admin dashboard.

### E10. Search & discovery

- Index documents per **product × market** (price and availability differ by market). Fields: title (multi-lingual), synonyms ("ghagra", "lengha", "chaniya choli" → lehenga), designer, fabric, work, colour family, occasion, stitching, price_minor, in_stock, rating, popularity, created_at.
- Indexing: outbox events → indexer worker (near real-time, < 30s) + a nightly full rebuild with an alias swap.
- Ranking: text relevance × business score (conversion, margin, stock depth, newness). Merchandising rules (pin, boost, bury) are editable in admin.
- Typesense or Meilisearch are fine to about a million documents and are far simpler to run. Move to OpenSearch when you need learning-to-rank or very large catalogues.

### E11. Caching, CDN, URLs

- URLs: `/{market}/{lang}/{path}` with `hreflang` alternates and a canonical per market.
- **Cache key = market + lang + path + normalised facet query.** PLP/PDP use ISR (revalidate 300s) plus on-demand revalidation on `ProductUpdated` and `PriceChanged`. Personalised fragments (wishlist hearts, recently viewed) load client-side.
- Bag, checkout, account and admin are never CDN-cached.
- Redis: carts (7-day TTL for anonymous users), sessions, rate limits, hot catalogue reads.
- Images: S3 originals → CloudFront with on-the-fly resize (AVIF/WebP), responsive `sizes`, and LQIP.

### E12. Events & jobs

- **Transactional outbox:** domain writes and `outbox` rows commit together. A relay publishes to SQS (or BullMQ at first). Consumers are idempotent, keyed by event ID.
- Scheduled jobs:
  - FX refresh (daily)
  - reservation sweeper (every minute)
  - carrier tracking poll (fallback to webhooks)
  - SLA risk scan (hourly)
  - abandoned-cart reminders (respect consent)
  - review requests (14 days after delivery)
  - points expiry
  - search rebuild (nightly)

### E13. Notifications

- Channels: email (SES/Postmark), SMS, WhatsApp (Meta Cloud API templates), push (later).
- Every send checks `notification_prefs`. Transactional messages bypass marketing opt-out but respect channel choice.
- Templates are versioned and localised. Every order event has a template: placed, fit-call reminder, QC photos, shipped, customs cleared, out for delivery, delivered, return label, refund issued.

### E14. Security, privacy, compliance

- Auth: email + password (argon2id), OTP via SMS/WhatsApp, Google/Apple OAuth, refresh-token rotation, device sessions list.
- Staff: SSO or password with **mandatory TOTP 2FA**, IP allow-list for finance actions, session timeout of 30 minutes.
- RBAC: permission strings (`orders:read`, `orders:refund`, `catalog:publish` …). Roles are bundles of permissions, checked in API guards and hidden in the UI. Every admin write lands in the append-only `audit_log` with before/after.
- PCI: hosted fields or redirect only, so card data never touches our servers (SAQ-A scope).
- Privacy: GDPR/UK GDPR for EU/UK, India's DPDP Act, and CCPA for California. Build in consent records, data export, deletion with anonymisation, cookie consent per market, and a published retention policy.
- App security: OWASP ASVS L2, CSP headers, rate limiting on auth/lookup/coupon endpoints, bot protection on checkout during sales, signed webhooks, secrets in AWS Secrets Manager, Dependabot and SAST in CI.

### E15. Reliability & observability

- SLOs:
  - storefront availability 99.9%
  - checkout success rate ≥ 97% of payment attempts
  - API p95 < 300ms for read endpoints, < 800ms for checkout confirm
- OpenTelemetry traces across Next.js → API → DB/Redis/queues. Logs to CloudWatch or Grafana Loki. Errors to Sentry. RUM for Core Web Vitals.
- Alerts:
  - payment failure rate > 5% over 10 minutes
  - webhook backlog
  - queue age > 5 minutes
  - SLA risk spikes
  - 5xx rate
- Backups: RDS PITR (7–35 days), weekly restore drill, S3 versioning on media.

### E16. Analytics & data platform

- One event taxonomy, shared by storefront and server:
  - `view_item_list`, `select_item`, `view_item`, `add_to_wishlist`, `add_to_cart`
  - `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`
  - `refund`, `return_requested`, `search`, `search_no_results`, `market_changed`
  - `measurement_started`, `measurement_completed`, `fit_call_booked`
- Pipeline: server events + outbox → Kinesis Firehose → S3 (Parquet, partitioned by date/market) → Glue Catalog → Athena for ad-hoc work, dbt models for marts (orders, cohorts, funnel, MTM SLA), and a BI tool for leadership.
- The admin dashboard reads operational KPIs from a read replica plus materialised views. Deep analytics live in the warehouse, not the OLTP database.

### E17. Scaling playbook (sale-day readiness)

| Stage | Traffic | What to do |
|---|---|---|
| Launch | < 50 orders/day | Single region (ap-south-1 or us-east-1 near most buyers; put the CDN everywhere), 2× API tasks, db.t4g/medium, Typesense single node |
| Growth | 500–5k orders/day | Autoscale API on CPU/RPS, read replica for admin/reporting, move queues to SQS, cache PLP aggressively, add a search replica |
| Sale events | 10–50× spikes | Load test at 10× with k6. Pre-warm caches. Queue-based "waiting room" in front of checkout. Pre-compute promotion eligibility. Cap coupon validation calls per user. Feature-flag non-critical widgets off. Freeze deploys 48h before |
| Scale-out | Myntra-like | Extract pricing/promotions and search into services, CQRS read models for catalogue, partition orders by month, multi-region read replicas, event bus on Kafka/MSK |

### E18. Testing & delivery

- Unit tests: pricing, duty, promotion rules, state machine (property-based tests for money maths).
- Contract tests from the OpenAPI spec. Integration tests run against Postgres/Redis in Testcontainers.
- E2E with Playwright: browse → PDP → MTM → checkout (test cards, 3DS) → confirmation → return. Run per market (US, UK, IN) with axe checks. Visual regression on key pages.
- CI (GitHub Actions): lint, typecheck, test, build, preview deploy per PR. Main deploys to staging; production uses tagged releases with blue/green or rolling deploys and DB migrations designed to be backwards-compatible.

### E19. Infrastructure (AWS)

- **Terraform modules:**
  - VPC
  - ECS Fargate services (storefront, admin, api, workers), or Vercel for the Next.js apps with the API on ECS
  - RDS Postgres (Multi-AZ in production)
  - ElastiCache Redis
  - S3 + CloudFront
  - SQS
  - Secrets Manager
  - WAF
  - Route 53
  - ACM
- **Environments:** dev (ephemeral per PR), staging (production-like, anonymised data), production.
- **Cost guardrails:** budgets and alarms, Graviton instances, S3 lifecycle rules, CDN-first for the heaviest pages.

---

## Part F — Admin back office

### F1. Modules (each is a canvas board)

| Module | Key features |
|---|---|
| Dashboard | Revenue and orders by market (selectable range), conversion, AOV, MTM SLA risk list, low stock, returns rate, alerts, recent orders |
| Orders (OMS) | Filterable table (status, market, MTM, payment, date); order side panel with timeline, items + customisations, payment, shipment, notes; actions: change status per state machine, create shipment/label, refund/partial refund, resend email, add internal note. Bulk: export CSV, print packing slips |
| Products | Catalogue table with status, stock, price per market, completeness score; bulk publish/archive/price update; import/export CSV |
| Product editor | Details (i18n), media manager with alt text, variants matrix (colour × size × stitching), customisation options + price deltas, prices per market (price books) with FX hint, inventory per warehouse, production days, HS code, SEO, preview |
| Production | Kanban by stage (awaiting fit call → cutting → embroidery → stitching → QC → ready); card shows order, due date, SLA status, tailor; drag to move (permission-checked); QC photo upload |
| Returns & refunds | RMA queue with status, reason, resolution; inspection checklist; approve/reject; issue refund or credit; alteration routing |
| Customers | Search, segments (VIP, at-risk, high-return), profile with orders, LTV, fit profiles, notes, communication log; GDPR export/delete |
| Promotions | Coupons (rules, limits, markets, schedule), sale events with countdown and banners, gift cards; live redemption stats |
| Content (CMS) | Homepage section builder per market (reorder, schedule, preview), banners, lookbooks, navigation menus |
| Settings | Markets (currency, duty mode, price book), FX table, duty & tax rules, shipping methods & carriers, payment providers, staff & roles matrix, audit log, integrations |
| Later | Reviews moderation, reports, support console (customer timeline + macros) |

### F2. Roles & permissions

| Permission ↓ / Role → | Super admin | Ops manager | CS agent | Catalog | Production lead | Marketing | Finance |
|---|---|---|---|---|---|---|---|
| orders:read | ✓ | ✓ | ✓ | – | ✓ | – | ✓ |
| orders:update_status | ✓ | ✓ | limited | – | MTM only | – | – |
| orders:refund | ✓ | ≤ $500 | – | – | – | – | ✓ |
| catalog:edit / publish | ✓ | – | – | ✓ / ✓ | – | – | – |
| prices:edit | ✓ | – | – | draft | – | – | approve |
| production:move | ✓ | ✓ | – | – | ✓ | – | – |
| returns:approve | ✓ | ✓ | ✓ | – | – | – | – |
| promotions:manage | ✓ | – | – | – | – | ✓ | view |
| cms:publish | ✓ | – | – | – | – | ✓ | – |
| customers:pii_export | ✓ | – | – | – | – | – | – |
| settings:markets / staff | ✓ | – | – | – | – | – | markets view |

Four-eyes rule: price changes over 20% and refunds over the limit need a second approver.

---

## Part G — Myntra parity: what was missing, and the plan

| Gap vs Myntra | Status | Phase |
|---|---|---|
| Search with autocomplete, synonyms, visual search | Designed (Search board); visual search later | 1 / 4 |
| Brand/designer stores + follow | Designed (Designer board) | 2 |
| Sale events (Myntra-style end-of-season sale), offers page, bank offers, countdown | Designed (Sale board) | 2 |
| Ratings & reviews with photos + fit feedback | Designed (Reviews board) | 2 |
| Loyalty (like Myntra Insider) + referrals | Designed (Rewards board) | 3 |
| Admin back office | Designed (10 admin boards) | 1–3 |
| Notifications inbox | Spec only | 2 |
| Gift cards (buy/send) | Spec only (admin + redeem designed) | 3 |
| Size/fit recommendation (fit assist from reviews + profiles) | Spec only | 3 |
| Shoppable videos / social feed (like Myntra Minis / Studio) | Spec only; lookbooks exist | 4 |
| Virtual try-on | Not planned until there is real demand | 5 |
| Seller/designer portal (marketplace) | Spec only | 4 |
| Mobile apps | PWA first; native apps once repeat purchase is proven | 4 |
| COD / UPI for India | Razorpay; COD only with OTP verification | 1 |
| Customer support console | Spec only | 3 |
| 404/500/maintenance, cookie consent | Spec only (simple) | 1 |

### Roadmap

- **Phase 0 (2 weeks):**
  - monorepo, CI, Terraform
  - design tokens + Storybook components
  - auth
  - markets & price books
  - seed catalogue
- **Phase 1 — sellable MVP (6–8 weeks):**
  - storefront: Home, Search, PLP, PDP (no MTM)
  - Bag, Checkout (cards, wallets, PayPal; Razorpay for IN)
  - DDP duty quote
  - Orders + tracking
  - admin: Dashboard-lite, Orders, Products, Product editor, Markets
  - transactional email
- **Phase 2 (6 weeks):**
  - MTM: measurement modal, fit profiles, fit calls, Production board
  - Returns/alterations + admin Returns
  - Wishlist boards
  - Reviews, Designer stores
  - Promotions + Sale events
  - CMS
  - WhatsApp notifications
- **Phase 3 (6 weeks):**
  - Loyalty & referrals
  - gift cards
  - Customers CRM
  - support console
  - fit recommendations
  - analytics warehouse & dashboards
  - sale-day hardening
- **Phase 4+:**
  - seller portal / marketplace
  - shoppable video
  - PWA → native apps
  - service extraction as load demands

---

## Part H — Decisions to make before Phase 1

1. **Single brand or marketplace?** This decides whether `designers` is a label or a seller with payouts (commission, KYC, settlements). Start as a curated brand with "designer" as a label, and design the schema so it can become a seller later.
2. **Legal entity and payment providers.** Stripe India is invite-only. Pick the provider that matches your entity and markets now.
3. **Duty engine:** internal tables (cheaper, more work) or a landed-cost provider (faster, per-order fee). Take the decision with a customs broker.
4. **Hosting:** all-AWS (ECS) or Vercel for the Next.js apps + AWS for the API and data. Vercel is faster to ship; ECS is cheaper at scale and keeps everything in one cloud.
5. **CMS:** in-house section JSON (matches the canvas, no licence) or a headless CMS (Payload/Sanity) if marketing needs rich editorial workflows.
6. **Return policy for semi-stitched items** and the alteration budget per order.

---

## Part I — Phase prompts (copy one at a time after the master prompt)

### I-1 Foundations
```text
Set up the Virasat monorepo per the master prompt. Create apps/storefront, apps/admin,
apps/api, packages/ui, packages/contracts, packages/config. Add Docker Compose for
Postgres 16, Redis 7 and Typesense. Configure ESLint/Prettier, Vitest, Playwright, GitHub
Actions (lint, typecheck, test, build). Implement packages/ui tokens exactly as listed and
build Storybook stories for Button, Input, Select, Checkbox, Radio, Switch, Chip, Badge,
Price, ProductCard, Accordion, Tabs, Stepper, Modal, Drawer, Toast, Breadcrumbs,
EmptyState, Skeleton, DataTable, StatTile, StatusPill, Timeline. Each story has an axe check.
Acceptance: `pnpm dev` runs all three apps; Storybook builds; CI is green.
```

### I-2 Markets, catalogue, pricing
```text
Implement the identity (users only), markets, pricing (price_books, prices, fx_rates,
duty_rules) and catalog modules in apps/api with Prisma migrations matching spec E4. Seed:
7 markets (US, GB, DE, CA, AU, AE, IN), 40 products across lehengas/sarees/sherwanis/
anarkalis with variants (stitching, size, colour), price books per market with charm
rounding, and duty rules with placeholder rates clearly marked TODO_VERIFY. Expose REST:
GET /markets, GET /products (filters, cursor pagination), GET /products/{slug},
GET /categories, POST /quotes/landed-cost. Unit-test money maths in minor units and the
landed-cost function (duty + VAT on value + duty + shipping).
Acceptance: OpenAPI is generated; the contracts package exports a typed client.
```

### I-3 Storefront browse
```text
Build the storefront Home, PLP, Search (autocomplete + results) and PDP per the canvas
boards 02, 03, 04 and 18. Use /{market}/{lang} routing with middleware that resolves the
market from URL → cookie → geo suggestion banner. Implement the navbar Ship-to/Currency
selector, facets with URL state, sort, density toggle, product cards with wishlist hearts
(signed-in only), the PDP gallery, stitching options with price deltas, the size selector
and the delivery-date calculator (calls the API). Index products per market into Typesense
via an outbox-driven indexer with synonyms. ISR on PLP/PDP with on-demand revalidation.
Acceptance: Lighthouse mobile ≥ 90 performance and 100 accessibility on PLP/PDP; prices
and dates change correctly across all 7 markets; Playwright browse test passes.
```

### I-4 Cart, checkout, payments, orders
```text
Implement cart (Redis for anonymous users, merged on login), the Bag page (board 06),
checkout accordion (board 07: address autocomplete with local labels, shipping methods
with dates, payment via PaymentProvider with Stripe-compatible hosted fields + PayPal +
Razorpay for IN), the landed-cost quote (DDP), promo codes, stock reservation (15-min TTL)
and the order state machine from spec E6 with order_status_history + outbox. The webhook is
the source of truth; the confirmation page (board 08) polls. Idempotency-Key on confirm.
Transactional emails: order placed. Acceptance: e2e for US (card + 3DS), GB (PayPal), IN
(UPI sandbox); double-click on "Place order" creates exactly one order; refund maths uses
snapshots.
```

### I-5 Account & self-service
```text
Build account pages per boards 09–17 using shared SiteHeader and AccountNav components:
overview, orders list with tabs/search, order tracking (6 Baymard details, carrier
webhooks → tracking_events), wishlist boards with share tokens + alerts, fit profiles CRUD +
fit-call slot booking (store UTC, display local), addresses & saved payment tokens,
store credit ledger, settings (notification matrix, 2FA, sessions, data export/delete),
help centre with guest order lookup (rate-limited).
Acceptance: every page has empty/error/loading states; all mutations are audited and
covered by API tests.
```

### I-6 Made-to-measure & production
```text
Implement the measurement modal (board 05) with per-field validation, unit conversion and
a figure highlight; fit profiles; production_jobs created from MTM order lines; the
production stage machine and SLA engine (spec E7); QC photo upload to S3; customer
photo-approval email; the capture policy for MTM; and the admin Production Kanban (board 27)
with permission-checked drag between stages.
Acceptance: an MTM order flows end-to-end in staging from checkout to ready_to_ship;
at-risk jobs show 48h ahead.
```

### I-7 Returns, alterations, refunds
```text
Build the returns flow (board 13) and the admin Returns queue (board 28): eligibility
engine (window, item type, MTM → alteration), reasons + photos, resolutions (exchange,
store credit + bonus, refund), pickup/drop-off with carrier label/QR, inspection
checklist, refunds via PaymentProvider including partial refunds and duty refunds,
store-credit ledger entries. Acceptance: refund preview equals the final refund in tests
for every market.
```

### I-8 Admin back office core
```text
Build apps/admin per boards 23–32 with the AdminNav shell: staff auth with mandatory TOTP,
RBAC permission guards (spec F2) on API and UI, audit log, Dashboard (KPIs from read
replica materialised views), Orders (table + side panel + actions), Products + Product
editor (variants matrix, per-market prices, media, SEO), Customers, Promotions (coupons,
sale events, gift cards), CMS section builder with scheduling and preview, Settings
(markets, FX, duty rules, shipping, payments, staff & roles).
Acceptance: each role sees only permitted nav items and actions; every write appears in the
audit log with before/after.
```

### I-9 Growth features
```text
Build Reviews (board 21) with moderation, the Designer store (board 20), the Sale/Offers
page (board 19) with a server-time countdown and coupon copy/apply, Rewards & referrals
(board 22) on an append-only points ledger, a notifications inbox, and abandoned-cart +
price-drop journeys respecting consent.
Acceptance: a sale-page load test at 10× baseline passes with p95 < 500ms from the CDN.
```

### I-10 Hardening & launch
```text
Add OpenTelemetry tracing, Sentry, RUM, SLO dashboards and alerts (spec E15); k6 load
tests for browse/checkout at 10×; WAF + bot protection on checkout; cookie consent per
market; GDPR/DPDP export & delete jobs; backup restore drill; runbooks for payment provider
outage, carrier outage and sale-day waiting room. Produce a launch checklist.
```