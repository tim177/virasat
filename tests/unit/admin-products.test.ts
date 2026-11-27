import { describe, expect, it } from "vitest";

import {
  fieldErrors,
  productFormFields,
  productFormSchema,
  slugify,
} from "@/lib/admin-products-input";
import { en } from "@/lib/i18n/en";
import { contentTypeForFile, detectImageKind } from "@/lib/image-file";
import { parseDollars } from "@/lib/money";
import { standardSizeLabels } from "@/lib/size-guide";

const e = en.admin.product.errors;
const SIZE_ID = "0190a0b0-0000-7000-8000-000000000001";

/** A valid draft, as the form sends it (strings, JSON for sizes and photos). */
function form(overrides: Record<string, unknown> = {}) {
  return {
    title: "Ruby silk saree",
    slug: "ruby-silk-saree",
    description: "A ruby silk saree with a woven gold border and a matching blouse piece.",
    category: "saree",
    gender: "women",
    fabric: "Silk",
    work: "Zari weave",
    colour: "Red",
    occasions: ["wedding", "festive"],
    care: "Dry clean only.",
    hsCode: "",
    price: "349",
    compareAt: "",
    readyDays: "5",
    customFitExtra: "",
    customDays: "",
    status: "draft",
    sizes: JSON.stringify([{ size: "One size", sku: "", stock: 4 }]),
    photos: JSON.stringify([{ url: "/uploads/products/a.webp", alt: "Model in the saree" }]),
    ...overrides,
  };
}

function errorsFor(input: Record<string, unknown>) {
  const result = productFormSchema.safeParse(input);
  return result.success ? {} : fieldErrors(result.error);
}

describe("money typed by the admin", () => {
  it.each([
    ["249", 24900],
    ["249.5", 24950],
    ["249.50", 24950],
    [" $1,249.00 ", 124900],
    ["0.99", 99],
  ])("%j is %i cents", (text, cents) => {
    expect(parseDollars(text)).toBe(cents);
  });

  it.each(["", "abc", "12.345", "-5", "1e3", "12,34.5x", "99999999"])(
    "%j is not an amount",
    (text) => {
      expect(parseDollars(text)).toBeNull();
    },
  );
});

describe("web addresses", () => {
  it("are made from the name", () => {
    expect(slugify("Ruby Banarasi Silk Saree!")).toBe("ruby-banarasi-silk-saree");
    expect(slugify("  Crème  brûlée -- lehenga ")).toBe("creme-brulee-lehenga");
    expect(slugify("---")).toBe("");
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(80);
  });
});

describe("product form", () => {
  it("accepts a valid draft and turns money into cents", () => {
    const value = productFormSchema.parse(form({ compareAt: "399.00" }));
    expect(value).toMatchObject({
      price: 34900,
      compareAt: 39900,
      readyDays: 5,
      customFitAvailable: false,
      hsCode: undefined,
      occasions: ["wedding", "festive"],
      sizes: [{ size: "One size", sku: undefined, stock: 4 }],
    });
  });

  it("keeps existing size ids and uppercases SKUs", () => {
    const value = productFormSchema.parse(
      form({ sizes: JSON.stringify([{ id: SIZE_ID, size: "M", sku: "vrs-12", stock: null }]) }),
    );
    expect(value.sizes).toEqual([{ id: SIZE_ID, size: "M", sku: "VRS-12", stock: null }]);
  });

  it("explains each problem next to its field", () => {
    expect(
      errorsFor(
        form({
          title: "",
          slug: "Not A Slug",
          description: "short",
          category: "hat",
          price: "free",
          readyDays: "0",
          compareAt: "100",
        }),
      ),
    ).toMatchObject({
      title: e.title,
      slug: e.slug,
      description: e.description,
      category: e.required,
      price: e.price,
      readyDays: e.days,
    });
    expect(errorsFor(form({ compareAt: "300" }))).toEqual({ compareAt: e.compareAt });
    expect(errorsFor(form({ customFitAvailable: "on" }))).toEqual({ customDays: e.customDays });
  });

  it("checks sizes and photos", () => {
    expect(
      errorsFor(
        form({
          sizes: JSON.stringify([
            { size: "M", stock: 1 },
            { size: "m", stock: 2 },
          ]),
        }),
      ),
    ).toEqual({ sizes: e.duplicateSize });
    expect(errorsFor(form({ sizes: JSON.stringify([{ size: "M", stock: -1 }]) }))).toEqual({
      sizes: e.sizes,
    });
    expect(errorsFor(form({ sizes: "not json" }))).toEqual({ sizes: e.sizes });
    expect(
      errorsFor(form({ photos: JSON.stringify([{ url: "/uploads/a.webp", alt: "" }]) })),
    ).toEqual({ photos: e.photos });
    expect(
      errorsFor(form({ photos: JSON.stringify([{ url: "javascript:alert(1)", alt: "Photo" }]) })),
    ).toEqual({ photos: e.photos });
  });

  it("publishing needs a photo, a size or custom fit, and the HS code", () => {
    expect(errorsFor(form({ status: "published", photos: "[]", sizes: "[]", hsCode: "" }))).toEqual(
      {
        photos: e.publishNeedsPhoto,
        sizes: e.publishNeedsSize,
        hsCode: e.publishNeedsHsCode,
      },
    );
    expect(
      errorsFor(
        form({
          status: "published",
          sizes: "[]",
          hsCode: "6204.44",
          customFitAvailable: "on",
          customFitExtra: "45",
          customDays: "28",
        }),
      ),
    ).toEqual({});
    expect(errorsFor(form({ hsCode: "62AB" }))).toEqual({ hsCode: e.hsCode });
  });

  it("reads every ticked occasion from the form", () => {
    const data = new FormData();
    data.set("id", "");
    data.set("title", "A");
    data.append("occasions", "wedding");
    data.append("occasions", "mehendi");
    expect(productFormFields(data)).toEqual({ title: "A", occasions: ["wedding", "mehendi"] });
  });
});

describe("uploaded photo files", () => {
  const bytes = (...values: Array<number | string>) =>
    new Uint8Array(
      values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])),
    );

  it("are recognised by their first bytes, not their name", () => {
    expect(detectImageKind(bytes(0xff, 0xd8, 0xff, 0xe0, ..."JFIF\0\0\0\0"))?.extension).toBe(
      "jpg",
    );
    expect(detectImageKind(bytes(0x89, "PNG\r\n\x1a\n", "\0\0\0\0"))?.extension).toBe("png");
    expect(detectImageKind(bytes("RIFF", "\0\0\0\0", "WEBP", "VP8 "))?.extension).toBe("webp");
    expect(detectImageKind(bytes("\0\0\0\x1c", "ftyp", "avif", "\0\0"))?.extension).toBe("avif");
    expect(detectImageKind(bytes("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(detectImageKind(bytes("GIF89a", "\0\0\0\0\0\0"))).toBeNull();
    expect(detectImageKind(bytes(0xff, 0xd8))).toBeNull();
  });

  it("are served with a type from their saved name", () => {
    expect(contentTypeForFile("a.webp")).toBe("image/webp");
    expect(contentTypeForFile("a.JPG")).toBe("image/jpeg");
    expect(contentTypeForFile("a.svg")).toBeNull();
  });
});

describe("standard sizes", () => {
  it("match the size guide", () => {
    expect(standardSizeLabels("women")).toEqual([
      "XS (US 0–2)",
      "S (US 4–6)",
      "M (US 8–10)",
      "L (US 12–14)",
      "XL (US 16–18)",
    ]);
    expect(standardSizeLabels("men")[1]).toBe('M (chest 38")');
  });
});
