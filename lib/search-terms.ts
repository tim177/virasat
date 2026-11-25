import type { Occasion, ProductCategory } from "@/lib/generated/prisma/enums";

// Turns what shoppers type ("red ghagra for mehndi") into structured search terms:
// categories, occasions and plain words. Pure logic, no database.

export type SearchTerms = {
  categories: ProductCategory[];
  occasions: Occasion[];
  /** Remaining words, matched against title, colour, fabric and work. */
  words: string[];
};

export const MAX_QUERY_LENGTH = 100;

// Multi-word phrases are matched first, then single words.
const categoryWords: Record<string, ProductCategory> = {
  "ghagra choli": "lehenga",
  "chaniya choli": "lehenga",
  "lehenga choli": "lehenga",
  "kurta set": "kurta_set",
  "kurta sets": "kurta_set",
  "kurta pajama": "kurta_set",
  "kurta pyjama": "kurta_set",
  "anarkali suit": "anarkali",
  lehenga: "lehenga",
  lehengas: "lehenga",
  lengha: "lehenga",
  lenghas: "lehenga",
  lehnga: "lehenga",
  ghagra: "lehenga",
  ghagras: "lehenga",
  chaniya: "lehenga",
  saree: "saree",
  sarees: "saree",
  sari: "saree",
  saris: "saree",
  anarkali: "anarkali",
  anarkalis: "anarkali",
  sherwani: "sherwani",
  sherwanis: "sherwani",
  achkan: "sherwani",
  kurta: "kurta_set",
  kurtas: "kurta_set",
  kurti: "kurta_set",
};

const occasionWords: Record<string, Occasion> = {
  wedding: "wedding",
  weddings: "wedding",
  bridal: "wedding",
  bride: "wedding",
  sangeet: "sangeet",
  mehendi: "mehendi",
  mehndi: "mehendi",
  haldi: "mehendi",
  reception: "reception",
  festive: "festive",
  festival: "festive",
  diwali: "festive",
  eid: "festive",
  navratri: "festive",
  party: "party",
  cocktail: "party",
};

// Shopper words → the words we store (colour and fabric values).
const wordSynonyms: Record<string, string> = {
  white: "ivory",
  cream: "ivory",
  "off-white": "ivory",
  golden: "gold",
  navy: "blue",
  burgundy: "maroon",
  wine: "maroon",
  rose: "pink",
  blush: "pink",
};

const stopWords = new Set(["a", "an", "and", "for", "in", "of", "the", "with", "to", "set"]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** Lowercases, strips punctuation and squeezes spaces. */
export function normalizeQuery(raw: string): string {
  return raw
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSearchQuery(raw: string): SearchTerms {
  let text = ` ${normalizeQuery(raw)} `;
  const categories: ProductCategory[] = [];
  const occasions: Occasion[] = [];

  for (const [phrase, category] of Object.entries(categoryWords)) {
    if (!phrase.includes(" ")) continue;
    if (text.includes(` ${phrase} `)) {
      categories.push(category);
      text = text.replaceAll(` ${phrase} `, " ");
    }
  }

  const words: string[] = [];
  for (const token of text.trim().split(" ")) {
    if (!token || stopWords.has(token)) continue;
    if (categoryWords[token]) categories.push(categoryWords[token]);
    else if (occasionWords[token]) occasions.push(occasionWords[token]);
    else words.push(wordSynonyms[token] ?? token);
  }

  return { categories: unique(categories), occasions: unique(occasions), words: unique(words) };
}

export function isEmptySearch(terms: SearchTerms): boolean {
  return terms.categories.length === 0 && terms.occasions.length === 0 && terms.words.length === 0;
}
