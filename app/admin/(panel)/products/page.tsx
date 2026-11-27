import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { StaticImage } from "@/components/ui/static-image";
import { requireAdmin } from "@/lib/admin-auth";
import { formatAdminDate } from "@/lib/admin-format";
import { listAdminProducts } from "@/lib/admin-products";
import { categoryByValue } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { ProductStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";

const t = en.admin.products;

export const metadata: Metadata = { title: t.metaTitle };

const paramsSchema = z.object({
  status: z.enum(ProductStatus).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h2">{t.title}</h1>
        <ButtonLink href="/admin/products/new">
          <PlusIcon className="size-4" />
          {t.add}
        </ButtonLink>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ProductsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function listHref(status: ProductStatus | undefined, q: string | undefined): string {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (q) query.set("q", q);
  const qs = query.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

async function ProductsList({
  searchParams,
}: {
  searchParams: PageProps<"/admin/products">["searchParams"];
}) {
  await requireAdmin();
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const params = paramsSchema.parse({ status: first(raw.status), q: first(raw.q) });
  const q = params.q || undefined;
  const { products, counts, countAll } = await listAdminProducts({ status: params.status, q });

  const tabs = [
    { status: undefined, label: t.all, count: countAll },
    ...Object.values(ProductStatus).map((status) => ({
      status,
      label: en.productStatus[status],
      count: counts[status] ?? 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Form action="/admin/products" className="flex flex-wrap items-end gap-3">
        {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
        <Input
          label={t.searchLabel}
          name="q"
          type="search"
          defaultValue={q ?? ""}
          className="w-full max-w-sm"
        />
        <Button type="submit" variant="secondary">
          {t.search}
        </Button>
        {q ? (
          <ButtonLink href={listHref(params.status, undefined)} variant="link">
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
                  href={listHref(tab.status, q)}
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

      {products.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title={countAll === 0 && !q ? t.empty : t.emptyFiltered}
          action={
            countAll === 0 && !q ? (
              <ButtonLink href="/admin/products/new">{t.add}</ButtonLink>
            ) : null
          }
        />
      ) : (
        <div
          className="overflow-x-auto rounded-card border border-line bg-white"
          role="region"
          aria-label={t.tableCaption}
          tabIndex={0}
        >
          <table className="w-full min-w-[48rem] text-left text-body-sm">
            <caption className="sr-only">{t.tableCaption}</caption>
            <thead className="border-b border-line bg-sand">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">{t.photo}</span>
                </th>
                {[t.product, t.category, t.price, t.stock, t.status, t.updated].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-2">
                    <div className="relative h-16 w-12 overflow-hidden rounded-card bg-jaali">
                      {product.imageUrl ? (
                        <StaticImage
                          src={product.imageUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                  </td>
                  <th scope="row" className="px-4 py-3 font-normal">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="inline-flex min-h-11 items-center font-medium text-crimson-700 underline underline-offset-4"
                    >
                      {product.title}
                    </Link>
                    <span className="block text-stone-700">/p/{product.slug}</span>
                  </th>
                  <td className="px-4 py-3">{categoryByValue(product.category).label}</td>
                  <td className="px-4 py-3">
                    <Price cents={product.priceCents} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    {product.stock === "made_to_order"
                      ? t.madeToOrder
                      : product.stock === 0
                        ? t.soldOut
                        : t.inStock(product.stock)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      tone={product.status === "published" ? "success" : "neutral"}
                      label={en.productStatus[product.status]}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatAdminDate(product.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
