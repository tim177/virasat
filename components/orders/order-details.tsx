import { MeasurementSummary } from "@/components/fit/measurement-summary";
import { buttonClasses } from "@/components/ui/button-styles";
import { ZariRule } from "@/components/ui/ornament";
import { Price } from "@/components/ui/price";
import { Timeline } from "@/components/ui/progress";
import { StaticImage } from "@/components/ui/static-image";
import { courierName, trackingUrl } from "@/lib/couriers";
import type { CustomerOrder } from "@/lib/customer-orders";
import { fitCallBaseUrl, fitCallUrl, needsFitCall } from "@/lib/fit-call";
import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";
import { customerTimeline } from "@/lib/order-timeline";

import { OrderStatusPill } from "./order-status-pill";

const t = en.orders;
const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "America/New_York",
});

type Address = {
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
};

/**
 * One order as the customer sees it (account page and email link): status timeline, fit call,
 * shipment, pieces with their measurements, address and payment. Never shows internal notes.
 */
export function OrderDetails({ order }: { order: CustomerOrder }) {
  const hasCustomItems = order.items.some((item) => item.isCustom);
  const timeline = customerTimeline(order.status, order.events);
  const bookingUrl = fitCallUrl(fitCallBaseUrl(), order);
  const showFitCall = needsFitCall({ ...order, hasCustomItems });
  const fitCallBooked = hasCustomItems && order.status === "paid" && order.fitCallBookedAt !== null;
  const address = order.shippingAddress as Address;
  const tracking =
    order.courier && order.trackingNumber
      ? {
          label: t.tracking(courierName(order.courier), order.trackingNumber),
          url: trackingUrl(order.courier, order.trackingNumber),
        }
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-display text-h1">{t.title(order.number)}</h1>
          <OrderStatusPill status={order.status} />
        </div>
        <ZariRule className="w-32" />
        <p className="text-stone-700">{t.placed(dateFormat.format(order.paidAt))}</p>
      </header>

      {showFitCall ? (
        <section
          aria-labelledby="fit-call"
          className="flex flex-col items-start gap-3 rounded-card border border-crimson-700 bg-crimson-50 p-6"
        >
          <h2 id="fit-call" className="font-display text-h3">
            {en.fitCall.title}
          </h2>
          <p>{en.fitCall.text}</p>
          {bookingUrl ? (
            <a href={bookingUrl} rel="noopener noreferrer" className={buttonClasses({})}>
              {en.fitCall.book}
            </a>
          ) : (
            <p className="text-stone-700">{en.fitCall.noLink}</p>
          )}
        </section>
      ) : null}
      {fitCallBooked ? (
        <p className="rounded-card bg-emerald-100 p-4 text-emerald-700">{en.fitCall.booked}</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-8">
          <section
            aria-labelledby="order-items"
            className="rounded-card border border-line bg-white p-6"
          >
            <h2 id="order-items" className="mb-4 font-display text-h3">
              {t.items}
            </h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex gap-4">
                    <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-card bg-jaali">
                      {item.imageSnapshot ? (
                        <StaticImage
                          src={item.imageSnapshot}
                          alt=""
                          fill
                          sizes="72px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-wrap justify-between gap-x-4 gap-y-1">
                      <div>
                        <p className="font-medium">{item.titleSnapshot}</p>
                        <p className="text-body-sm text-stone-700">
                          {item.isCustom ? en.bag.customFit : en.bag.size(item.size ?? "")} ·{" "}
                          {en.email.qty(item.quantity)}
                        </p>
                      </div>
                      <Price cents={item.unitPriceCents * item.quantity} />
                    </div>
                  </div>
                  {item.isCustom ? (
                    <div className="flex flex-col gap-2 rounded-card bg-sand p-4 text-body-sm">
                      <h3 className="font-medium">{t.measurementsTitle}</h3>
                      <MeasurementSummary
                        measurements={item.measurements}
                        emptyText={t.noMeasurements}
                      />
                      {item.measurements && order.status === "paid" ? (
                        <p className="text-stone-700">{t.measurementsHelp}</p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-body-sm">
              <div className="flex justify-between">
                <dt>{en.email.subtotal}</dt>
                <dd className="tabular-nums">{formatCents(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 ? (
                <div className="flex justify-between">
                  <dt>{en.email.discount}</dt>
                  <dd className="tabular-nums">−{formatCents(order.discountCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>{en.bag.shipping}</dt>
                <dd className="text-emerald-700">
                  {order.shippingCents === 0
                    ? en.bag.shippingFree
                    : formatCents(order.shippingCents)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>{en.bag.duties}</dt>
                <dd className="text-emerald-700">{en.bag.dutiesIncluded}</dd>
              </div>
              <div className="flex justify-between text-body font-medium">
                <dt>{en.email.total}</dt>
                <dd className="tabular-nums">{formatCents(order.totalCents)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="order-status">
            <h2 id="order-status" className="mb-4 font-display text-h3">
              {t.status}
            </h2>
            <Timeline
              items={timeline.map((step) => ({
                label: t.steps[step.status],
                state: step.state,
                date: step.date ? dateFormat.format(step.date) : undefined,
              }))}
            />
          </section>

          <section aria-labelledby="order-shipment">
            <h2 id="order-shipment" className="mb-3 font-display text-h3">
              {t.shipment}
            </h2>
            {tracking ? (
              <div className="flex flex-col items-start gap-2">
                <p>{tracking.label}</p>
                {tracking.url ? (
                  <a
                    href={tracking.url}
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-crimson-700 underline"
                  >
                    {t.track}
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-stone-700">{t.notShipped}</p>
            )}
          </section>

          <section aria-labelledby="order-address">
            <h2 id="order-address" className="mb-3 font-display text-h3">
              {t.shipTo}
            </h2>
            <p className="text-stone-700">
              {order.customerName}
              <br />
              {address.line1}
              {address.line2 ? (
                <>
                  <br />
                  {address.line2}
                </>
              ) : null}
              <br />
              {address.city}, {address.state} {address.postalCode}
            </p>
          </section>

          <p className="text-body-sm text-stone-700">{t.questions}</p>
        </div>
      </div>
    </div>
  );
}
