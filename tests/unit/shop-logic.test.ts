import { describe, expect, it } from "vitest";

import { addBusinessDays, deliveryDayRange, deliveryWindow } from "@/lib/delivery";
import {
  activeFilterCount,
  listingHref,
  parseListingParams,
  withoutValue,
} from "@/lib/listing-params";
import { isEmptySearch, normalizeQuery, parseSearchQuery } from "@/lib/search-terms";

describe("parseSearchQuery", () => {
  it("maps spelling variants to categories", () => {
    for (const q of ["ghagra", "Lengha", "lehnga", "chaniya choli", "LEHENGAS"]) {
      expect(parseSearchQuery(q).categories, q).toEqual(["lehenga"]);
    }
    expect(parseSearchQuery("sari").categories).toEqual(["saree"]);
    expect(parseSearchQuery("kurta pajama").categories).toEqual(["kurta_set"]);
    expect(parseSearchQuery("achkan").categories).toEqual(["sherwani"]);
  });

  it("splits categories, occasions and words", () => {
    expect(parseSearchQuery("Red ghagra for Mehndi!")).toEqual({
      categories: ["lehenga"],
      occasions: ["mehendi"],
      words: ["red"],
    });
  });

  it("maps colour synonyms and drops stop words", () => {
    expect(parseSearchQuery("white silk saree with gold").words).toEqual(["ivory", "silk", "gold"]);
    expect(parseSearchQuery("navy anarkali").words).toEqual(["blue"]);
  });

  it("treats punctuation-only and empty input as empty", () => {
    expect(isEmptySearch(parseSearchQuery("  !!  "))).toBe(true);
    expect(isEmptySearch(parseSearchQuery(""))).toBe(true);
  });

  it("caps very long queries", () => {
    expect(normalizeQuery("a".repeat(500))).toHaveLength(100);
  });
});

describe("parseListingParams", () => {
  it("keeps valid filters and drops unknown values", () => {
    const query = parseListingParams({
      occasion: ["wedding", "not-an-occasion", "wedding"],
      colour: "Red",
      fabric: ["Silk", " ", "Velvet"],
      sort: "price-asc",
      page: "2",
    });
    expect(query).toEqual({
      occasions: ["wedding"],
      colours: ["Red"],
      fabrics: ["Silk", "Velvet"],
      sort: "price-asc",
      page: 2,
    });
  });

  it("falls back to defaults for malformed values", () => {
    expect(parseListingParams({ sort: "cheapest", page: "-3" })).toMatchObject({
      sort: "newest",
      page: 1,
    });
    expect(parseListingParams({ page: "999" }).page).toBe(1);
    expect(parseListingParams({ page: "2.5" }).page).toBe(1);
  });

  it("only reads the category filter on the all-products page", () => {
    expect(parseListingParams({ category: "sarees" }).category).toBeUndefined();
    expect(parseListingParams({ category: "sarees" }, { allowCategory: true }).category).toBe(
      "saree",
    );
    expect(
      parseListingParams({ category: "nonsense" }, { allowCategory: true }).category,
    ).toBeUndefined();
  });

  it("limits how many values one filter accepts", () => {
    const many = Array.from({ length: 50 }, (_, i) => `Colour${i}`);
    expect(parseListingParams({ colour: many }).colours).toHaveLength(10);
  });
});

describe("listingHref", () => {
  it("round-trips a query through the URL", () => {
    const query = parseListingParams(
      {
        category: "sherwanis",
        occasion: "wedding",
        colour: ["Ivory", "Maroon"],
        sort: "price-desc",
        page: "3",
      },
      { allowCategory: true },
    );
    const href = listingHref("/shop", query);
    expect(href).toBe(
      "/shop?category=sherwanis&occasion=wedding&colour=Ivory&colour=Maroon&sort=price-desc&page=3",
    );
    const params = Object.fromEntries(
      [...new URL(href, "http://x").searchParams.keys()].map((k) => [
        k,
        new URL(href, "http://x").searchParams.getAll(k),
      ]),
    );
    expect(parseListingParams(params, { allowCategory: true })).toEqual(query);
  });

  it("leaves out defaults", () => {
    expect(listingHref("/c/sarees", parseListingParams({}))).toBe("/c/sarees");
  });

  it("removes one value and resets to page 1", () => {
    const query = parseListingParams({ colour: ["Red", "Pink"], page: "3" });
    const next = withoutValue(query, "colours", "Red");
    expect(next.colours).toEqual(["Pink"]);
    expect(next.page).toBe(1);
    expect(activeFilterCount(next)).toBe(1);
  });
});

describe("delivery estimates", () => {
  it("adds production, shipping and a buffer", () => {
    expect(deliveryDayRange(3)).toEqual({ min: 7, max: 11 });
    expect(deliveryDayRange(0)).toEqual({ min: 4, max: 8 });
  });

  it("skips weekends", () => {
    const friday = new Date(2027, 2, 5); // Fri 5 Mar 2027
    expect(addBusinessDays(friday, 1).toDateString()).toBe(new Date(2027, 2, 8).toDateString());
    expect(addBusinessDays(friday, 5).toDateString()).toBe(new Date(2027, 2, 12).toDateString());
  });

  it("starts counting from the next business day when ordered on a weekend", () => {
    const saturday = new Date(2027, 2, 6);
    expect(addBusinessDays(saturday, 1).toDateString()).toBe(new Date(2027, 2, 8).toDateString());
  });

  it("gives an earliest and latest date", () => {
    const monday = new Date(2027, 2, 1);
    const { earliest, latest } = deliveryWindow(monday, 3);
    expect(earliest.toDateString()).toBe(new Date(2027, 2, 10).toDateString()); // +7 business days
    expect(latest.toDateString()).toBe(new Date(2027, 2, 16).toDateString()); // +11 business days
  });

  it("rejects impossible production times", () => {
    expect(() => deliveryDayRange(-1)).toThrow(RangeError);
    expect(() => deliveryDayRange(1.5)).toThrow(RangeError);
  });
});
