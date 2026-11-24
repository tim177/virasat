import type {
  Gender,
  Occasion,
  ProductCategory,
  ProductStatus,
} from "../lib/generated/prisma/enums";

// Sample catalogue for development and tests. Photos are generated artwork in /public/seed,
// not real product photos. Prices are all-inclusive USD in cents (duties + shipping included).
// hsCode is left empty: real codes come from the customs broker (plan Step 0).

export type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  category: ProductCategory;
  gender: Gender;
  fabric: string;
  work: string;
  colour: string;
  occasions: Occasion[];
  care: string;
  priceCents: number;
  compareAtCents?: number;
  /** Set to offer custom fit; the extra price in cents. */
  customFitExtraCents?: number;
  readyDays: number;
  customDays?: number;
  status: ProductStatus;
  /** stock: null = made to order (never sold out). */
  sizes: Array<{ size: string; stock: number | null }>;
};

const DRY_CLEAN = "Dry clean only. Store folded in a muslin bag, away from direct sunlight.";
const GENTLE_WASH = "Gentle hand wash in cold water or dry clean. Dry in shade.";

const womenSizes = (stock: Array<number | null>) =>
  ["XS (US 0–2)", "S (US 4–6)", "M (US 8–10)", "L (US 12–14)", "XL (US 16–18)"].map((size, i) => ({
    size,
    stock: stock[i] ?? null,
  }));

const menSizes = (stock: Array<number | null>) =>
  ['S (chest 36")', 'M (chest 38")', 'L (chest 40")', 'XL (chest 42")', 'XXL (chest 44")'].map(
    (size, i) => ({ size, stock: stock[i] ?? null }),
  );

const madeToOrder = [null, null, null, null, null];

export const seedProducts: SeedProduct[] = [
  {
    slug: "crimson-silk-bridal-lehenga",
    title: "Crimson silk bridal lehenga",
    description:
      "A pure silk bridal lehenga in deep crimson, hand-embroidered with zardozi in antique gold. Comes with a matching blouse and a sheer organza dupatta.",
    category: "lehenga",
    gender: "women",
    fabric: "Silk",
    work: "Zardozi",
    colour: "Red",
    occasions: ["wedding", "reception"],
    care: DRY_CLEAN,
    priceCents: 124000,
    customFitExtraCents: 6000,
    readyDays: 21,
    customDays: 35,
    status: "published",
    sizes: womenSizes(madeToOrder),
  },
  {
    slug: "blush-organza-lehenga",
    title: "Blush organza lehenga",
    description:
      "Light, airy organza in soft blush, scattered with hand-placed sequins that catch the light as you move. Made for sangeet nights and receptions.",
    category: "lehenga",
    gender: "women",
    fabric: "Organza",
    work: "Sequin",
    colour: "Pink",
    occasions: ["sangeet", "reception", "party"],
    care: DRY_CLEAN,
    priceCents: 68000,
    compareAtCents: 79000,
    customFitExtraCents: 4500,
    readyDays: 3,
    customDays: 28,
    status: "published",
    sizes: womenSizes([1, 3, 0, 2, 1]),
  },
  {
    slug: "emerald-velvet-lehenga",
    title: "Emerald velvet lehenga",
    description:
      "Rich emerald velvet with a heavy zardozi border and a fitted, long-line blouse. A winter-wedding favourite.",
    category: "lehenga",
    gender: "women",
    fabric: "Velvet",
    work: "Zardozi",
    colour: "Green",
    occasions: ["wedding", "reception"],
    care: DRY_CLEAN,
    priceCents: 92000,
    customFitExtraCents: 6000,
    readyDays: 14,
    customDays: 30,
    status: "published",
    sizes: womenSizes(madeToOrder),
  },
  {
    slug: "marigold-cotton-silk-lehenga",
    title: "Marigold cotton-silk lehenga",
    description:
      "A cheerful marigold lehenga in breathable cotton silk with gota patti trims. Easy to dance in from mehendi to the last festive night.",
    category: "lehenga",
    gender: "women",
    fabric: "Cotton silk",
    work: "Gota patti",
    colour: "Yellow",
    occasions: ["mehendi", "festive"],
    care: GENTLE_WASH,
    priceCents: 45000,
    customFitExtraCents: 4500,
    readyDays: 3,
    customDays: 21,
    status: "published",
    sizes: womenSizes([2, 4, 4, 3, 0]),
  },
  {
    slug: "ruby-banarasi-silk-saree",
    title: "Ruby Banarasi silk saree",
    description:
      "Hand-woven Banarasi silk in ruby red with a gold zari pallu. Includes unstitched blouse fabric, or choose custom fit for a stitched blouse.",
    category: "saree",
    gender: "women",
    fabric: "Silk",
    work: "Banarasi weave",
    colour: "Red",
    occasions: ["wedding", "festive"],
    care: DRY_CLEAN,
    priceCents: 39000,
    customFitExtraCents: 3500,
    readyDays: 3,
    customDays: 14,
    status: "published",
    sizes: [{ size: "One size (blouse fabric included)", stock: 6 }],
  },
  {
    slug: "ivory-chikankari-georgette-saree",
    title: "Ivory chikankari georgette saree",
    description:
      "Fine Lucknowi chikankari hand embroidery on flowing ivory georgette. Quietly elegant for daytime celebrations.",
    category: "saree",
    gender: "women",
    fabric: "Georgette",
    work: "Chikankari",
    colour: "Ivory",
    occasions: ["festive", "party"],
    care: DRY_CLEAN,
    priceCents: 26000,
    readyDays: 3,
    status: "published",
    sizes: [{ size: "One size (blouse fabric included)", stock: 4 }],
  },
  {
    slug: "emerald-georgette-anarkali",
    title: "Emerald georgette anarkali",
    description:
      "A floor-length anarkali in emerald georgette with gota patti borders that flare beautifully when you twirl. Comes with churidar and dupatta.",
    category: "anarkali",
    gender: "women",
    fabric: "Georgette",
    work: "Gota patti",
    colour: "Green",
    occasions: ["festive", "sangeet"],
    care: DRY_CLEAN,
    priceCents: 32900,
    compareAtCents: 38900,
    customFitExtraCents: 4000,
    readyDays: 3,
    customDays: 21,
    status: "published",
    sizes: womenSizes([2, 2, 3, 1, 1]),
  },
  {
    slug: "midnight-blue-velvet-anarkali",
    title: "Midnight blue velvet anarkali",
    description:
      "Deep midnight velvet with tonal resham embroidery at the yoke and hem. Made for evening receptions.",
    category: "anarkali",
    gender: "women",
    fabric: "Velvet",
    work: "Resham",
    colour: "Blue",
    occasions: ["reception", "party"],
    care: DRY_CLEAN,
    priceCents: 42000,
    customFitExtraCents: 4000,
    readyDays: 3,
    customDays: 21,
    status: "published",
    sizes: womenSizes([0, 2, 2, 2, 1]),
  },
  {
    slug: "ivory-raw-silk-sherwani",
    title: "Ivory raw-silk sherwani",
    description:
      "A classic groom's sherwani in ivory raw silk with fine resham work at the collar and cuffs. Comes with a matching churidar.",
    category: "sherwani",
    gender: "men",
    fabric: "Raw silk",
    work: "Resham",
    colour: "Ivory",
    occasions: ["wedding"],
    care: DRY_CLEAN,
    priceCents: 49900,
    customFitExtraCents: 5000,
    readyDays: 7,
    customDays: 28,
    status: "published",
    sizes: menSizes([1, 2, 2, 1, 0]),
  },
  {
    slug: "maroon-jacquard-sherwani",
    title: "Maroon jacquard sherwani",
    description:
      "Woven maroon jacquard with zardozi buttons and a structured, tailored fit. For the groom or the groom's family.",
    category: "sherwani",
    gender: "men",
    fabric: "Jacquard",
    work: "Zardozi",
    colour: "Maroon",
    occasions: ["wedding", "reception"],
    care: DRY_CLEAN,
    priceCents: 64000,
    customFitExtraCents: 5000,
    readyDays: 7,
    customDays: 28,
    status: "published",
    sizes: menSizes(madeToOrder),
  },
  {
    slug: "sage-linen-kurta-set",
    title: "Sage linen kurta set",
    description:
      "A relaxed kurta and pyjama set in breathable sage linen with tonal thread work at the placket. Ideal for mehendi and daytime events.",
    category: "kurta_set",
    gender: "men",
    fabric: "Linen",
    work: "Thread work",
    colour: "Green",
    occasions: ["festive", "mehendi"],
    care: GENTLE_WASH,
    priceCents: 18000,
    readyDays: 3,
    status: "published",
    sizes: menSizes([3, 5, 5, 4, 2]),
  },
  {
    slug: "rose-silk-kurta-set",
    title: "Rose silk kurta set",
    description:
      "A straight silk kurta in rose pink with mirror work at the neckline, paired with palazzo pants and a light dupatta.",
    category: "kurta_set",
    gender: "women",
    fabric: "Silk",
    work: "Mirror work",
    colour: "Pink",
    occasions: ["festive", "sangeet"],
    care: DRY_CLEAN,
    priceCents: 22000,
    customFitExtraCents: 3000,
    readyDays: 3,
    customDays: 14,
    status: "published",
    sizes: womenSizes([2, 3, 3, 2, 1]),
  },
  {
    slug: "gold-tissue-lehenga",
    title: "Gold tissue lehenga",
    description: "Draft product for testing: not shown in the shop until published.",
    category: "lehenga",
    gender: "women",
    fabric: "Tissue",
    work: "Zardozi",
    colour: "Gold",
    occasions: ["wedding"],
    care: DRY_CLEAN,
    priceCents: 86000,
    customFitExtraCents: 6000,
    readyDays: 14,
    customDays: 30,
    status: "draft",
    sizes: womenSizes(madeToOrder),
  },
];

/** Photos for a seed product: generated artwork, front view and fabric detail. */
export function seedImages(product: SeedProduct) {
  const name = product.title.toLowerCase();
  return [
    { url: `/seed/${product.slug}-1.webp`, alt: `Sample artwork of the ${name}, front view` },
    { url: `/seed/${product.slug}-2.webp`, alt: `Sample artwork of the ${name}, fabric detail` },
  ];
}

/** Stable SKU, e.g. VRS-0001-M. */
export function seedSku(productIndex: number, size: string): string {
  const sizeCode = size.startsWith("One size") ? "ONE" : size.split(" ")[0];
  return `VRS-${String(productIndex + 1).padStart(4, "0")}-${sizeCode}`;
}
