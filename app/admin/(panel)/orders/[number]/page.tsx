import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, useId, type ReactNode } from "react";
import { z } from "zod";

import { EditMeasurementsButton, MarkFitCallBookedForm } from "@/components/admin/fit-call-actions";
import {
  OrderNoteForm,
  OrderStatusActions,
  ResendConfirmationForm,
} from "@/components/admin/order-actions";
import { MeasurementSummary } from "@/components/fit/measurement-summary";
import { OrderStatusPill } from "@/components/orders/order-status-pill";
import { Badge } from "@/components/ui/badge";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { StaticImage } from "@/components/ui/static-image";
import { requireAdmin } from "@/lib/admin-auth";
import { formatAdminDateTime } from "@/lib/admin-format";
import { getAdminOrder, type AdminOrder } from "@/lib/admin-orders";
import { courierName, trackingUrl } from "@/lib/couriers";
import { en } from "@/lib/i18n/en";
import { measurementShapeSchema } from "@/lib/measurements";
import { formatCents } from "@/lib/money";
import { adminNextStatuses } from "@/lib/order-status";
import { MEASUREMENT_EDIT_STATUSES } from "@/lib/orders";
import { stripePaymentUrl } from "@/lib/stripe";

const t = en.admin.order;
const numberSchema = z.string().regex(/^VRS-\d{1,9}$/);

export async function generateMetadata({
  params,
}: PageProps<"/admin/orders/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: t.metaTitle(decodeURIComponent(number)) };
}

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[number]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/orders"
        className="inline-flex min-h-11 items-center gap-1 self-start text-body-sm hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.back}
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrderDetails params={params} />
      </Suspense>
    </div>
  );
}

async function OrderDetails({ params }: { params: PageProps<"/admin/orders/[number]">["params"] }) {
  await requireAdmin();
  const number = numberSchema.safeParse(decodeURIComponent((await params).number));
  if (!number.success) notFound();
  const order = await getAdminOrder(number.data);
  if (!order) notFound();

  const hasCustomItems = order.items.some((item) => item.isCustom);
  const next = adminNextStatuses(order.status, { hasCustomItems });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-h2">{order.number}</h1>
        <OrderStatusPill status={order.status} />
        {hasCustomItems ? <Badge tone="accent">{t.customFit}</Badge> : null}
        <p className="w-full text-body-sm text-stone-700">
          {t.placed(formatAdminDateTime(order.createdAt))}
        </p>
      </header>

      <Card title={t.nextStep}>
        <OrderStatusActions orderId={order.id} status={order.status} next={next} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card title={t.items}>
            <Items order={order} />
          </Card>
          <Card title={t.history}>
            <History order={order} />
            <div className="mt-6 border-t border-line pt-6">
              <OrderNoteForm orderId={order.id} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {hasCustomItems ? (
            <Card title={t.fitCall}>
              <FitCallDetails order={order} />
            </Card>
          ) : null}
          <Card title={t.customer}>
            <CustomerDetails order={order} />
            <ResendConfirmationForm orderId={order.id} />
          </Card>
          <Card title={t.payment}>
            <PaymentDetails order={order} />
          </Card>
          <Card title={t.shipment}>
            <ShipmentDetails order={order} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-line bg-white p-5">
      <h2 id={headingId} className="mb-4 font-display text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FitCallDetails({ order }: { order: AdminOrder }) {
  return (
    <div className="flex flex-col gap-3 text-body-sm">
      {order.fitCallBookedAt ? (
        <p className="text-emerald-700">
          {t.fitCallBooked(formatAdminDateTime(order.fitCallBookedAt))}
        </p>
      ) : (
        <p>{t.fitCallNotBooked}</p>
      )}
      {order.fitCallReminderSentAt ? (
        <p className="text-stone-700">
          {t.fitCallReminder(formatAdminDateTime(order.fitCallReminderSentAt))}
        </p>
      ) : !order.fitCallBookedAt && order.status === "paid" ? (
        <p className="text-stone-700">{t.fitCallReminderDue}</p>
      ) : null}
      {!order.fitCallBookedAt && order.status === "paid" ? (
        <MarkFitCallBookedForm orderId={order.id} />
      ) : null}
    </div>
  );
}

function Items({ order }: { order: AdminOrder }) {
  const editable = MEASUREMENT_EDIT_STATUSES.includes(order.status);
  return (
    <ul className="divide-y divide-line">
      {order.items.map((item) => {
        return (
          <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
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
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{item.titleSnapshot}</p>
                <Price cents={item.unitPriceCents * item.quantity} size="sm" />
              </div>
              <p className="text-body-sm text-stone-700">
                {item.isCustom ? t.customFit : t.size(item.size ?? "")} ·{" "}
                {t.quantity(item.quantity)} · {formatCents(item.unitPriceCents)}
              </p>
              {item.isCustom ? (
                <div className="text-body-sm">
                  <p className="font-medium">{t.measurements}</p>
                  <MeasurementSummary
                    measurements={item.measurements}
                    emptyText={t.noMeasurements}
                    className="mt-1"
                  />
                  {editable ? (
                    <EditMeasurementsButton
                      orderId={order.id}
                      itemId={item.id}
                      title={item.titleSnapshot}
                      kind={stored(item.measurements)?.kind ?? item.product?.gender ?? "women"}
                      measurements={stored(item.measurements)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The saved measurements, if they have the usual shape (older hand-entered ones don't). */
function stored(raw: unknown) {
  const parsed = measurementShapeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function CustomerDetails({ order }: { order: AdminOrder }) {
  const address = order.shippingAddress as {
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
  };
  return (
    <div className="mb-3 flex flex-col gap-4 text-body-sm">
      <p>
        {order.customerName}
        <br />
        <a href={`mailto:${order.email}`} className="text-crimson-700 underline underline-offset-4">
          {order.email}
        </a>
        {order.phone ? (
          <>
            <br />
            <a
              href={`tel:${order.phone}`}
              className="text-crimson-700 underline underline-offset-4"
            >
              {order.phone}
            </a>
          </>
        ) : null}
      </p>
      <div>
        <p className="font-medium">{t.shipTo}</p>
        <p className="text-stone-700">
          {address.line1}
          {address.line2 ? (
            <>
              <br />
              {address.line2}
            </>
          ) : null}
          <br />
          {address.city}, {address.state ?? ""} {address.postalCode}
          <br />
          {address.country}
        </p>
      </div>
    </div>
  );
}

function PaymentDetails({ order }: { order: AdminOrder }) {
  return (
    <div className="flex flex-col gap-4 text-body-sm">
      <dl className="flex flex-col gap-2">
        <div className="flex justify-between">
          <dt>{t.subtotal}</dt>
          <dd className="tabular-nums">{formatCents(order.subtotalCents)}</dd>
        </div>
        {order.discountCents > 0 ? (
          <div className="flex justify-between">
            <dt>{t.discount}</dt>
            <dd className="tabular-nums">−{formatCents(order.discountCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>{t.shipping}</dt>
          <dd className="tabular-nums">
            {order.shippingCents === 0 ? t.shippingFree : formatCents(order.shippingCents)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 font-medium">
          <dt>{t.totalPaid}</dt>
          <dd className="tabular-nums">{formatCents(order.totalCents)}</dd>
        </div>
      </dl>
      {order.stripePaymentIntentId ? (
        <a
          href={stripePaymentUrl(order.stripePaymentIntentId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-crimson-700 underline underline-offset-4"
        >
          {t.viewInStripe}
        </a>
      ) : null}
      <p className="text-stone-700">{t.refundHint}</p>
    </div>
  );
}

function ShipmentDetails({ order }: { order: AdminOrder }) {
  if (!order.courier || !order.trackingNumber) {
    return <p className="text-body-sm text-stone-700">{t.notShipped}</p>;
  }
  const url = trackingUrl(order.courier, order.trackingNumber);
  return (
    <dl className="flex flex-col gap-2 text-body-sm">
      <div>
        <dt className="text-stone-700">{t.courier}</dt>
        <dd>{courierName(order.courier)}</dd>
      </div>
      <div>
        <dt className="text-stone-700">{t.trackingNumber}</dt>
        <dd className="flex flex-wrap items-center gap-3">
          <span className="tabular-nums" data-testid="tracking-number">
            {order.trackingNumber}
          </span>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-crimson-700 underline underline-offset-4"
            >
              {t.trackParcel}
            </a>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}

function actorLabel(event: AdminOrder["events"][number]): string {
  if (event.actor === "stripe") return t.byStripe;
  if (event.actor === "system") return t.bySystem;
  return event.actorName ?? t.byAdmin;
}

function History({ order }: { order: AdminOrder }) {
  return (
    <ol className="flex flex-col gap-4" data-testid="order-history">
      {order.events.map((event) => (
        <li key={event.id} className="flex flex-col gap-0.5 border-l-2 border-gold-500 pl-4">
          <p className="font-medium">
            {event.toStatus
              ? event.fromStatus
                ? t.statusChange(en.orderStatus[event.fromStatus], en.orderStatus[event.toStatus])
                : t.created(en.orderStatus[event.toStatus])
              : t.noteLabel}
          </p>
          {event.note ? <p className="text-body-sm whitespace-pre-line">{event.note}</p> : null}
          <p className="text-caption text-stone-700">
            {formatAdminDateTime(event.createdAt)} · {actorLabel(event)}
          </p>
        </li>
      ))}
    </ol>
  );
}
