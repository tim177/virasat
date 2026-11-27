import type { BagLine } from "@/lib/bag-schema";
import { checkedMeasurements, type MeasurementKind, type MeasurementSet } from "@/lib/measurements";
import { lineTotalCents } from "@/lib/money";

// Prices a bag against products from our database. Pure: no database, no Stripe.
// This is the only place a line's price is decided, for both the bag page and checkout.

export type PricingProduct = {
  id: string;
  slug: string;
  title: string;
  gender: MeasurementKind;
  published: boolean;
  priceCents: number;
  customFitAvailable: boolean;
  customFitExtraCents: number;
  readyDays: number;
  customDays: number | null;
  imageUrl: string | null;
  variants: Array<{ id: string; size: string; stock: number | null }>;
};

export type LineProblem =
  "unavailable" | "sold_out" | "not_enough_stock" | "custom_unavailable" | "measurements_needed";

export type PricedLine = {
  lineId: string;
  productId: string | null;
  productSlug: string;
  variantId: string | null;
  title: string;
  /** Size label, or null for custom fit. */
  size: string | null;
  isCustom: boolean;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  productionDays: number;
  imageUrl: string | null;
  /** Which measurement list a custom-fit line needs (the product's gender). */
  measurementKind: MeasurementKind | null;
  /** Custom fit: the checked measurements, or null while they're missing or out of range. */
  measurements: MeasurementSet | null;
  problem: LineProblem | null;
  /** When there isn't enough stock: how many can still be bought. */
  availableQuantity: number | null;
};

export type PricedBag = {
  lines: PricedLine[];
  /** Sum of the lines that can be bought. */
  subtotalCents: number;
  /** True when every line can be bought as-is. */
  ok: boolean;
};

function unavailableLine(line: BagLine, title: string, problem: LineProblem): PricedLine {
  return {
    lineId: line.id,
    productId: null,
    productSlug: line.productSlug,
    variantId: line.variantId,
    title,
    size: null,
    isCustom: line.custom,
    quantity: line.quantity,
    unitPriceCents: 0,
    lineTotalCents: 0,
    productionDays: 0,
    imageUrl: null,
    measurementKind: null,
    measurements: null,
    problem,
    availableQuantity: null,
  };
}

export function priceBag(lines: BagLine[], products: Map<string, PricingProduct>): PricedBag {
  const priced = lines.map((line): PricedLine => {
    const product = products.get(line.productSlug);
    if (!product || !product.published) {
      return unavailableLine(line, product?.title ?? line.productSlug, "unavailable");
    }

    const base = {
      lineId: line.id,
      productId: product.id,
      productSlug: product.slug,
      title: product.title,
      quantity: line.quantity,
      imageUrl: product.imageUrl,
      measurementKind: line.custom ? product.gender : null,
    };

    if (line.custom) {
      if (!product.customFitAvailable || product.customDays === null) {
        return { ...unavailableLine(line, product.title, "custom_unavailable"), ...base };
      }
      const unit = product.priceCents + product.customFitExtraCents;
      // Never trust the browser: the measurements are checked again here, for this product.
      const measurements = checkedMeasurements(line.measurements);
      const usable = measurements && measurements.kind === product.gender ? measurements : null;
      return {
        ...base,
        variantId: null,
        size: null,
        isCustom: true,
        unitPriceCents: unit,
        lineTotalCents: lineTotalCents(unit, line.quantity),
        productionDays: product.customDays,
        measurements: usable,
        problem: usable ? null : "measurements_needed",
        availableQuantity: null,
      };
    }

    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) return { ...unavailableLine(line, product.title, "unavailable"), ...base };

    let problem: LineProblem | null = null;
    let availableQuantity: number | null = null;
    if (variant.stock !== null && variant.stock === 0) problem = "sold_out";
    else if (variant.stock !== null && variant.stock < line.quantity) {
      problem = "not_enough_stock";
      availableQuantity = variant.stock;
    }

    return {
      ...base,
      variantId: variant.id,
      size: variant.size,
      isCustom: false,
      unitPriceCents: product.priceCents,
      lineTotalCents: lineTotalCents(product.priceCents, line.quantity),
      productionDays: product.readyDays,
      measurements: null,
      problem,
      availableQuantity,
    };
  });

  const subtotalCents = priced
    .filter((line) => line.problem === null)
    .reduce((sum, line) => sum + line.lineTotalCents, 0);

  return { lines: priced, subtotalCents, ok: priced.every((line) => line.problem === null) };
}
