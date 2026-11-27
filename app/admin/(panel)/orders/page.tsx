import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { OrderStatusPill } from "@/components/orders/order-status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin-auth";
import { formatAdminDate } from "@/lib/admin-format";
import { type AdminOrderListParams, parseAdminOrderParams } from "@/lib/admin-orders-input";
import { listAdminOrders } from "@/lib/admin-orders";
import { cn } from "@/lib/cn";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";

const t = en.admin.orders;

export const metadata: Metadata = { title: t.metaTitle };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h2">{t.title}</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <OrdersList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** /admin/orders with these filters (page 1 unless given). */
function listHref(params: AdminOrderListParams, changes: Partial<AdminOrderListParams>): string {
  const next = { ...params, page: 1, ...changes };
  const query = new URLSearchParams();
  if (next.status) query.set("status", next.status);
  if (next.q) query.set("q", next.q);
  if (next.page > 1) query.set("page", String(next.page));
  const qs = query.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
}

async function OrdersList({
  searchParams,
}: {
  searchParams: PageProps<"/admin/orders">["searchParams"];
}) {
  await requireAdmin();
  const params = parseAdminOrderParams(await searchParams);
  const { orders, total, pages, counts, countAll } = await listAdminOrders(params);

  const tabs = [
    { status: undefined, label: t.all, count: countAll },
    ...Object.values(OrderStatus).map((status) => ({
      status,
      label: en.orderStatus[status],
      count: counts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Form action="/admin/orders" className="flex flex-wrap items-end gap-3">
        {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
        <Input
          label={t.searchLabel}
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          className="w-full max-w-sm"
        />
        <Button type="submit" variant="secondary">
          {t.search}
        </Button>
        {params.q ? (
          <ButtonLink href={listHref(params, { q: undefined })} variant="link">
            {t.clearSearch}
          </ButtonLink>
        ) : null}
      </Form>

      <nav aria-label={t.tabsLabel}>
        <ul className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const current = tab.status === params.status;
            return (
              <li key={tab.status ?? "all"}>
                <Link
                  href={listHref(params, { status: tab.status })}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-body-sm",
                    current
                      ? "border-charcoal bg-charcoal text-white"
                      : "border-line bg-white text-charcoal hover:border-charcoal",
                  )}
                >
                  {tab.label}
                  <span className="tabular-nums">{tab.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title={countAll === 0 && !params.q ? t.empty : t.emptyFiltered}
        />
      ) : (
        <>
          <p className="text-body-sm text-stone-700" role="status">
            {t.count(total)}
          </p>
          <div
            className="overflow-x-auto rounded-card border border-line bg-white"
            role="region"
            aria-label={t.tableCaption}
            tabIndex={0}
          >
            <table className="w-full min-w-[44rem] text-left text-body-sm">
              <caption className="sr-only">{t.tableCaption}</caption>
              <thead className="border-b border-line bg-sand">
                <tr>
                  {[t.number, t.date, t.customer, t.items, t.total, t.status].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      <Link
                        href={`/admin/orders/${order.number}`}
                        className="inline-flex min-h-11 items-center text-crimson-700 underline underline-offset-4"
                      >
                        {order.number}
                      </Link>
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatAdminDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{order.customerName}</span>
                      <span className="block text-stone-700">{order.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap items-center gap-2">
                        {t.itemCount(order.pieces)}
                        {order.hasCustom ? <Badge tone="accent">{t.customFit}</Badge> : null}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Price cents={order.totalCents} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusPill status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 ? (
            <nav
              aria-label={t.page(params.page, pages)}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              {params.page > 1 ? (
                <ButtonLink href={listHref(params, { page: params.page - 1 })} variant="secondary">
                  {t.newer}
                </ButtonLink>
              ) : (
                <span />
              )}
              <span className="text-body-sm text-stone-700">{t.page(params.page, pages)}</span>
              {params.page < pages ? (
                <ButtonLink href={listHref(params, { page: params.page + 1 })} variant="secondary">
                  {t.older}
                </ButtonLink>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
