"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { AlertCircleIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { track } from "@/lib/analytics";
import { MAX_QUANTITY, type BagLine } from "@/lib/bag-schema";
import { removeLine, setLineMeasurements, setLineQuantity, useBag } from "@/lib/bag-store";
import { en } from "@/lib/i18n/en";
import type { MeasurementSet } from "@/lib/measurements";
import { formatCents } from "@/lib/money";
import type { PricedBag, PricedLine } from "@/lib/pricing";
import { useHydrated } from "@/lib/use-hydrated";

const t = en.bag;

const MeasurementDialog = dynamic(
  () => import("@/components/fit/measurement-dialog").then((m) => m.MeasurementDialog),
  { ssr: false },
);

/** The bag page: lines from the browser, prices and availability from the server. */
export function BagView() {
  const hydrated = useHydrated();
  const lines = useBag();
  const linesKey = JSON.stringify(lines);
  const [quote, setQuote] = useState<{ key: string; bag: PricedBag } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const toast = useToast();

  // Re-price whenever the bag changes. Prices always come from the server.
  useEffect(() => {
    const current = JSON.parse(linesKey) as unknown[];
    if (current.length === 0) return;
    const controller = new AbortController();
    fetch("/api/bag/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: current }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`quote failed: ${response.status}`);
        return (await response.json()) as PricedBag;
      })
      .then((bag) => {
        setQuote({ key: linesKey, bag });
        setFailedKey(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailedKey(linesKey);
      });
    return () => controller.abort();
  }, [linesKey, retry]);

  if (!hydrated) return <BagSkeleton />;

  if (lines.length === 0) {
    return (
      <EmptyState
        title={t.emptyTitle}
        description={t.emptyText}
        action={<ButtonLink href="/shop">{t.startShopping}</ButtonLink>}
      />
    );
  }

  if (failedKey === linesKey) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-4 rounded-card border border-error bg-white p-6"
      >
        <p className="flex items-start gap-2 text-error">
          <AlertCircleIcon className="mt-0.5 size-5 shrink-0" />
          {t.loadError}
        </p>
        <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
          {t.tryAgain}
        </Button>
      </div>
    );
  }

  if (!quote) return <BagSkeleton />;

  const bag = quote.bag;
  const updating = quote.key !== linesKey;

  async function checkout() {
    if (!bag.ok || checkingOut) return;
    setCheckingOut(true);
    track("begin_checkout", { value_cents: bag.subtotalCents, items: lines.length });
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (response.status === 409) {
        const data = (await response.json()) as { bag: PricedBag };
        setQuote({ key: linesKey, bag: data.bag });
        toast({ title: t.bagChanged, description: t.bagChangedText, tone: "error" });
        setCheckingOut(false);
        return;
      }
      if (!response.ok) throw new Error(`checkout failed: ${response.status}`);
      const { url } = (await response.json()) as { url: string };
      window.location.assign(url); // Stripe's payment page; keep the button busy until it loads
    } catch {
      toast({ title: t.checkoutError, tone: "error" });
      setCheckingOut(false);
    }
  }

  return (
    <div
      className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-12"
      aria-busy={updating || undefined}
    >
      <section aria-labelledby="bag-items">
        <h2 id="bag-items" className="sr-only">
          {t.title}
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {bag.lines.map((line) => (
            <BagRow
              key={line.lineId}
              line={line}
              stored={lines.find((stored) => stored.id === line.lineId)}
            />
          ))}
        </ul>
      </section>

      <aside
        aria-labelledby="bag-summary"
        className="flex h-fit flex-col gap-4 rounded-card border border-line bg-white p-6"
      >
        <h2 id="bag-summary" className="font-display text-h3">
          {t.summary}
        </h2>
        <dl className="flex flex-col gap-2 text-body-sm">
          <div className="flex justify-between gap-4">
            <dt>{t.subtotal}</dt>
            <dd className="tabular-nums">{formatCents(bag.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t.shipping}</dt>
            <dd className="text-emerald-700">{t.shippingFree}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t.duties}</dt>
            <dd className="text-emerald-700">{t.dutiesIncluded}</dd>
          </div>
          <div className="mt-2 flex justify-between gap-4 border-t border-line pt-3 text-body font-medium">
            <dt>{t.total}</dt>
            <dd className="tabular-nums" data-testid="bag-total">
              {formatCents(bag.subtotalCents)}
            </dd>
          </div>
        </dl>
        <Button
          size="lg"
          fullWidth
          loading={checkingOut}
          aria-disabled={!bag.ok || updating || undefined}
          aria-describedby={bag.ok ? undefined : "bag-fix-problems"}
          onClick={checkout}
        >
          {t.checkout}
        </Button>
        {!bag.ok ? (
          <p id="bag-fix-problems" className="text-body-sm text-error">
            {t.fixProblems}
          </p>
        ) : null}
        <p className="text-body-sm text-stone-700">{t.secureNote}</p>
        <p className="text-body-sm text-stone-700">{t.promoNote}</p>
      </aside>
    </div>
  );
}

function problemText(line: PricedLine): string | null {
  switch (line.problem) {
    case "unavailable":
      return t.problems.unavailable;
    case "sold_out":
      return t.problems.sold_out;
    case "custom_unavailable":
      return t.problems.custom_unavailable;
    case "not_enough_stock":
      return t.problems.not_enough_stock(line.availableQuantity ?? 0);
    case "measurements_needed":
      return t.problems.measurements_needed;
    default:
      return null;
  }
}

function BagRow({ line, stored }: { line: PricedLine; stored: BagLine | undefined }) {
  const problem = problemText(line);
  const href = `/p/${line.productSlug}`;
  const canBuy =
    line.problem === null ||
    line.problem === "not_enough_stock" ||
    line.problem === "measurements_needed";
  const [measuring, setMeasuring] = useState(false);
  const toast = useToast();
  // What the shopper entered (even if a check now fails), so editing starts from it.
  const savedMeasurements = (line.measurements ??
    stored?.measurements ??
    null) as MeasurementSet | null;
  const measurementKind = line.measurementKind;
  const maxQuantity = Math.min(MAX_QUANTITY, line.availableQuantity ?? MAX_QUANTITY);

  return (
    <li className="flex gap-4 py-5" data-testid="bag-line">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative h-32 w-24 shrink-0 overflow-hidden rounded-card bg-jaali"
      >
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt="" fill sizes="96px" className="object-cover" />
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4">
          <h3 className="font-medium">
            <Link href={href} className="hover:underline">
              {line.title}
            </Link>
          </h3>
          {canBuy ? <Price cents={line.lineTotalCents} /> : null}
        </div>
        <p className="text-body-sm text-stone-700">
          {line.isCustom ? t.customFit : line.size ? t.size(line.size) : null}
          {canBuy ? ` · ${formatCents(line.unitPriceCents)}` : null}
        </p>
        {line.isCustom ? <p className="text-body-sm text-stone-700">{t.customFitNote}</p> : null}
        {line.isCustom && line.measurements ? (
          <p className="text-body-sm text-emerald-700">
            {en.fit.kinds[line.measurements.kind]} · {en.fit.unitNames[line.measurements.unit]}
          </p>
        ) : null}
        {problem ? (
          <p className="flex items-start gap-1.5 text-body-sm text-error">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            {problem}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {canBuy ? (
            <div
              role="group"
              aria-label={t.quantity}
              className="flex items-center rounded-pill border border-stone-700"
            >
              <IconButton
                label={t.decrease(line.title)}
                disabled={line.quantity <= 1}
                onClick={() => setLineQuantity(line.lineId, line.quantity - 1)}
              >
                <MinusIcon className="size-5" />
              </IconButton>
              <span className="w-8 text-center tabular-nums" aria-live="polite">
                {line.quantity}
              </span>
              <IconButton
                label={t.increase(line.title)}
                disabled={line.quantity >= maxQuantity}
                onClick={() => setLineQuantity(line.lineId, line.quantity + 1)}
              >
                <PlusIcon className="size-5" />
              </IconButton>
            </div>
          ) : null}
          {line.problem === "not_enough_stock" && line.availableQuantity ? (
            <Button
              variant="link"
              onClick={() => setLineQuantity(line.lineId, line.availableQuantity ?? 1)}
            >
              {t.reduceTo(line.availableQuantity)}
            </Button>
          ) : null}
          {line.isCustom && measurementKind ? (
            <Button variant="link" onClick={() => setMeasuring(true)}>
              {line.measurements ? t.editMeasurements : t.addMeasurements}
              <span className="sr-only"> {t.measurementsFor(line.title)}</span>
            </Button>
          ) : null}
          <Button
            variant="link"
            aria-label={t.remove(line.title)}
            onClick={() => removeLine(line.lineId)}
          >
            {t.removeShort}
          </Button>
        </div>
      </div>
      {/* Stays mounted, so closing it returns focus to the button that opened it. */}
      {line.isCustom && measurementKind ? (
        <MeasurementDialog
          open={measuring}
          onClose={() => setMeasuring(false)}
          kind={measurementKind}
          initial={savedMeasurements?.kind === measurementKind ? savedMeasurements : null}
          title={line.measurements ? en.fit.editTitle : en.fit.formTitle}
          submitLabel={en.fit.save}
          onDone={(set) => {
            setLineMeasurements(line.lineId, set);
            toast({ title: t.measurementsSaved, description: line.title, tone: "success" });
          }}
          source="bag"
        />
      ) : null}
    </li>
  );
}

function BagSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <p className="sr-only">{en.ui.loading}</p>
      <div className="flex flex-col gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-32 w-24" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
