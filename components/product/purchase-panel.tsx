"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AlertCircleIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { track } from "@/lib/analytics";
import { addToBag } from "@/lib/bag-store";
import { cn } from "@/lib/cn";
import { deliveryDayRange, deliveryWindow } from "@/lib/delivery";
import type { Gender } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";
import type { MeasurementSet } from "@/lib/measurements";
import { formatCents } from "@/lib/money";
import { useToday } from "@/lib/use-today";

import { SizeGuideButton } from "./size-guide";

// The measurement form loads only when a shopper picks custom fit, so the product page stays light.
const MeasurementDialog = dynamic(
  () => import("@/components/fit/measurement-dialog").then((m) => m.MeasurementDialog),
  { ssr: false },
);

export type PurchaseSize = { id: string; size: string; stock: number | null };

type Props = {
  slug: string;
  title: string;
  gender: Gender;
  priceCents: number;
  sizes: PurchaseSize[];
  readyDays: number;
  customFit: { extraCents: number; days: number } | null;
};

const CUSTOM = "custom";
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** Size choice (or custom fit), delivery estimate and the add-to-bag button. */
export function PurchasePanel({
  slug,
  title,
  gender,
  priceCents,
  sizes,
  readyDays,
  customFit,
}: Props) {
  const [choice, setChoice] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const firstOptionRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const today = useToday();
  const ids = { legend: useId(), hint: useId(), error: useId() };

  const isCustom = choice === CUSTOM;
  const productionDays = isCustom && customFit ? customFit.days : readyDays;
  const days = deliveryDayRange(productionDays);
  const estimate = today ? deliveryWindow(today, productionDays) : null;
  const ready = choice !== null;

  function handleAddToBag() {
    if (!ready) {
      setShowError(true);
      firstOptionRef.current?.focus();
      return;
    }
    // Custom fit: measurements first, then the piece goes in the bag with them.
    if (isCustom) {
      setMeasuring(true);
      return;
    }
    addLine(null);
  }

  function addLine(measurements: MeasurementSet | null) {
    const sizeLabel = isCustom
      ? en.bag.customFit
      : (sizes.find((s) => s.id === choice)?.size ?? "");
    const added = addToBag({
      productSlug: slug,
      variantId: isCustom ? null : choice,
      custom: isCustom,
      measurements,
    });
    if (!added) {
      toast({ title: en.bag.full, description: en.bag.fullText, tone: "error" });
      return;
    }
    track("add_to_cart", {
      slug,
      choice: isCustom ? "custom" : sizeLabel,
      price_cents: priceCents + (isCustom && customFit ? customFit.extraCents : 0),
    });
    toast({
      title: en.bag.added,
      description: en.bag.addedDetail(title, sizeLabel),
      tone: "success",
      action: { label: en.bag.viewBag, href: "/bag" },
    });
  }

  const firstEnabled = sizes.findIndex((s) => s.stock !== 0);

  return (
    <div className="flex flex-col gap-5">
      <fieldset
        aria-describedby={showError && !ready ? ids.error : undefined}
        className="relative flex flex-col gap-3"
      >
        {/* The legend must stay the fieldset's first child so the group keeps its name. */}
        <legend id={ids.legend} className="float-left min-h-11 pt-2.5 text-body-sm font-medium">
          {en.product.sizeLegend}
        </legend>
        <div className="absolute top-0 right-0">
          <SizeGuideButton gender={gender} />
        </div>

        {showError && !ready ? (
          <p id={ids.error} className="flex items-start gap-1.5 text-body-sm text-error">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            {en.product.chooseFirstError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {sizes.map((size, index) => {
            const soldOut = size.stock === 0;
            return (
              <label key={size.id} className={cn("relative", soldOut && "cursor-not-allowed")}>
                <input
                  ref={index === firstEnabled ? firstOptionRef : undefined}
                  type="radio"
                  name={`size-${slug}`}
                  value={size.id}
                  checked={choice === size.id}
                  disabled={soldOut}
                  onChange={() => {
                    setChoice(size.id);
                    setShowError(false);
                  }}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-field border px-3 text-body-sm transition-colors duration-150",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus-ring)",
                    soldOut
                      ? "border-line bg-sand text-stone-700 line-through"
                      : "cursor-pointer border-stone-700 bg-white peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-white hover:bg-sand peer-checked:hover:bg-charcoal",
                  )}
                >
                  {size.size}
                  {soldOut ? <span className="sr-only"> ({en.product.soldOut})</span> : null}
                </span>
              </label>
            );
          })}
        </div>

        {customFit ? (
          <label className="relative block">
            <input
              ref={firstEnabled === -1 ? firstOptionRef : undefined}
              type="radio"
              name={`size-${slug}`}
              value={CUSTOM}
              checked={isCustom}
              onChange={() => {
                setChoice(CUSTOM);
                setShowError(false);
              }}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-11 cursor-pointer flex-col justify-center rounded-field border border-stone-700 bg-white px-4 py-2.5 transition-colors duration-150 hover:bg-sand",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus-ring)",
                "peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-white peer-checked:hover:bg-charcoal",
              )}
            >
              <span className="text-body-sm font-medium">{en.product.customFit}</span>
              <span className="text-caption">
                {en.product.customFitDescription(`+${formatCents(customFit.extraCents)}`)}
              </span>
            </span>
          </label>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1 text-body-sm" data-testid="delivery-estimate">
        <p className="font-medium">
          {estimate
            ? en.product.deliveryDates(
                dateFormat.format(estimate.earliest),
                dateFormat.format(estimate.latest),
              )
            : en.product.deliveryDays(days.min, days.max)}
        </p>
        {isCustom ? <p className="text-stone-700">{en.product.deliveryCustom}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          onClick={handleAddToBag}
          aria-disabled={!ready || undefined}
          aria-describedby={ready && !isCustom ? undefined : ids.hint}
        >
          {isCustom ? en.product.enterMeasurements : en.product.addToBag}
        </Button>
        {!ready || isCustom ? (
          <p id={ids.hint} className="text-center text-body-sm text-stone-700">
            {isCustom ? en.product.measurementsNext : en.product.chooseFirst}
          </p>
        ) : null}
      </div>

      {customFit && isCustom ? (
        <MeasurementDialog
          open={measuring}
          onClose={() => setMeasuring(false)}
          kind={gender}
          initial={null}
          title={en.fit.formTitle}
          submitLabel={en.fit.addToBag}
          onDone={addLine}
          source={slug}
        />
      ) : null}
    </div>
  );
}
