import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin-auth";
import { formatAdminDateTime } from "@/lib/admin-format";
import { listAdminLog } from "@/lib/admin-log";
import { actionLabel, describeChanges } from "@/lib/admin-log-view";
import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

const t = en.admin.log;

export const metadata: Metadata = { title: t.metaTitle };

const paramsSchema = z.object({
  entity: z.enum(["order", "product"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

type Params = z.infer<typeof paramsSchema>;

export default function AdminLogPage({ searchParams }: PageProps<"/admin/log">) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h2">{t.title}</h1>
        <p className="text-stone-700">{t.intro}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LogEntries searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function logHref(params: Params, changes: Partial<Params>): string {
  const next = { ...params, page: 1, ...changes };
  const query = new URLSearchParams();
  if (next.entity) query.set("entity", next.entity);
  if (next.page > 1) query.set("page", String(next.page));
  const qs = query.toString();
  return qs ? `/admin/log?${qs}` : "/admin/log";
}

async function LogEntries({
  searchParams,
}: {
  searchParams: PageProps<"/admin/log">["searchParams"];
}) {
  await requireAdmin();
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const params = paramsSchema.parse({ entity: first(raw.entity), page: first(raw.page) ?? 1 });
  const { entries, pages } = await listAdminLog(params);

  const tabs = [
    { entity: undefined, label: t.all },
    { entity: "order" as const, label: t.orders },
    { entity: "product" as const, label: t.products },
  ];

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label={t.tabsLabel}>
        <ul className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const current = tab.entity === params.entity;
            return (
              <li key={tab.entity ?? "all"}>
                <Link
                  href={logHref(params, { entity: tab.entity })}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-pill border px-4 text-body-sm",
                    current
                      ? "border-charcoal bg-charcoal text-white"
                      : "border-line bg-white text-charcoal hover:border-charcoal",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {entries.length === 0 ? (
        <EmptyState headingLevel={2} title={t.empty} />
      ) : (
        <div
          className="overflow-x-auto rounded-card border border-line bg-white"
          role="region"
          aria-label={t.tableCaption}
          tabIndex={0}
        >
          <table className="w-full min-w-[52rem] text-left text-body-sm" data-testid="admin-log">
            <caption className="sr-only">{t.tableCaption}</caption>
            <thead className="border-b border-line bg-sand">
              <tr>
                {[t.when, t.who, t.what, t.changes].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {entries.map((entry) => {
                const changes = describeChanges(entry.before, entry.after);
                return (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatAdminDateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{entry.adminName}</span>
                      {entry.ip ? (
                        <span className="block text-caption text-stone-700">{entry.ip}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{actionLabel(entry.action)}</span>
                      {entry.target ? (
                        <Link
                          href={entry.target.href}
                          className="inline-flex min-h-11 items-center text-crimson-700 underline underline-offset-4"
                        >
                          {entry.target.name}
                        </Link>
                      ) : (
                        <span className="block text-stone-700">{t.removed}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {changes.length === 0 ? (
                        <span className="text-stone-700">—</span>
                      ) : (
                        <dl className="flex flex-col gap-1">
                          {changes.map((change) => (
                            <div key={change.field}>
                              <dt className="inline font-medium">{change.label}: </dt>
                              <dd className="inline">
                                {change.before === "—" && !entry.before ? (
                                  change.after
                                ) : (
                                  <>
                                    <span className="text-stone-700 line-through">
                                      <span className="sr-only">{t.from} </span>
                                      {change.before}
                                    </span>{" "}
                                    →{" "}
                                    <span>
                                      <span className="sr-only">{t.to} </span>
                                      {change.after}
                                    </span>
                                  </>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav
          aria-label={t.page(params.page, pages)}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          {params.page > 1 ? (
            <ButtonLink href={logHref(params, { page: params.page - 1 })} variant="secondary">
              {t.newer}
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="text-body-sm text-stone-700">{t.page(params.page, pages)}</span>
          {params.page < pages ? (
            <ButtonLink href={logHref(params, { page: params.page + 1 })} variant="secondary">
              {t.older}
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
