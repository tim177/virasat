import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { OrderStatusPill } from "@/components/orders/order-status-pill";
import { ChevronRightIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin-auth";
import { getDashboard, LOW_STOCK_AT } from "@/lib/admin-dashboard";
import { formatAdminDate } from "@/lib/admin-format";
import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";

const t = en.admin.home;

export const metadata: Metadata = { title: en.admin.dashboard };

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-display text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Dashboard() {
  const admin = await requireAdmin();
  const data = await getDashboard(new Date());
  const tiles = [
    { label: t.today, sales: data.sales.today },
    { label: t.week, sales: data.sales.week },
    { label: t.month, sales: data.sales.month },
  ];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h2">{en.admin.dashboard}</h1>
        <p className="text-stone-700">{en.admin.welcome(admin.name)}</p>
      </header>

      <Panel id="sales" title={t.salesTitle}>
        <ul className="grid gap-4 sm:grid-cols-3">
          {tiles.map((tile) => (
            <li
              key={tile.label}
              className="flex flex-col gap-1 rounded-card border border-line bg-white p-5"
              data-testid="sales-tile"
            >
              <p className="text-body-sm text-stone-700">{tile.label}</p>
              <p className="text-h2 font-semibold">{formatCents(tile.sales.revenueCents)}</p>
              <p className="text-body-sm">{t.orders(tile.sales.orders)}</p>
            </li>
          ))}
        </ul>
        <p className="text-caption text-stone-700">{t.salesNote}</p>
      </Panel>

      <div className="grid gap-10 lg:grid-cols-2">
        <Panel id="waiting" title={t.waitingTitle}>
          <ul className="divide-y divide-line rounded-card border border-line bg-white">
            {data.waiting.map(({ status, count }) => (
              <li key={status}>
                <Link
                  href={`/admin/orders?status=${status}`}
                  className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 hover:bg-sand"
                >
                  <span>{t.waiting[status]}</span>
                  <span className="flex items-center gap-2">
                    <span className={cn("text-h3 font-semibold", count === 0 && "text-stone-700")}>
                      {count}
                    </span>
                    <span className="sr-only">{t.ordersWord(count)}</span>
                    <ChevronRightIcon className="size-4 text-stone-700" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="low-stock" title={t.lowStockTitle}>
          <p className="text-body-sm text-stone-700">{t.lowStockNote(LOW_STOCK_AT)}</p>
          {data.lowStock.length === 0 ? (
            <p className="rounded-card border border-line bg-white p-5">{t.noLowStock}</p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-line bg-white">
              <table className="w-full text-left text-body-sm">
                <caption className="sr-only">{t.lowStockTitle}</caption>
                <thead className="border-b border-line bg-sand">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t.product}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t.size}
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      {t.stock}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.lowStock.map((row) => (
                    <tr key={row.variantId}>
                      <th scope="row" className="px-4 py-2 font-normal">
                        <Link
                          href={`/admin/products/${row.productId}`}
                          className="inline-flex min-h-11 items-center text-crimson-700 underline underline-offset-4"
                        >
                          {row.title}
                        </Link>
                      </th>
                      <td className="px-4 py-2">{row.size}</td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right tabular-nums",
                          row.stock === 0 && "font-medium text-error",
                        )}
                      >
                        {t.left(row.stock)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.lowStockTotal > data.lowStock.length ? (
            <p className="text-body-sm text-stone-700">
              {t.lowStockMore(data.lowStock.length, data.lowStockTotal)}
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel id="latest" title={t.latestTitle}>
        {data.latest.length === 0 ? (
          <p className="rounded-card border border-line bg-white p-5">{t.noOrders}</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-white">
            {data.latest.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3"
              >
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Link
                    href={`/admin/orders/${order.number}`}
                    className="inline-flex min-h-11 items-center font-medium text-crimson-700 underline underline-offset-4"
                  >
                    {order.number}
                  </Link>
                  <span>{order.customerName}</span>
                  <span className="text-body-sm text-stone-700">
                    {formatAdminDate(order.createdAt)}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="tabular-nums">{formatCents(order.totalCents)}</span>
                  <OrderStatusPill status={order.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/admin/orders"
          className="inline-flex min-h-11 items-center gap-1 self-start text-crimson-700 underline underline-offset-4"
        >
          {t.allOrders}
          <ChevronRightIcon className="size-4" />
        </Link>
      </Panel>
    </div>
  );
}
