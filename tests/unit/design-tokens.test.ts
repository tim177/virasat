import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Reads the colour tokens straight from app/globals.css, so changing a token can never
// silently break text contrast (WCAG 2.2 AA: 4.5:1 for text, 3:1 for UI boundaries).

const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function colour(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Missing colour token --color-${name}`);
  return value;
}

// [foreground, background] pairs the components actually use for text.
const textPairs: Array<[string, string]> = [
  ["charcoal", "ivory"],
  ["charcoal", "white"],
  ["charcoal", "sand"],
  ["stone-700", "ivory"],
  ["stone-700", "white"],
  ["stone-700", "sand"],
  ["crimson-700", "ivory"],
  ["crimson-700", "white"],
  ["crimson-700", "crimson-50"],
  ["white", "crimson-700"],
  ["white", "crimson-800"],
  ["gold-700", "ivory"],
  ["gold-700", "white"],
  ["emerald-700", "emerald-100"],
  ["emerald-700", "white"],
  ["white", "emerald-700"],
  ["error", "white"],
  ["error", "ivory"],
  ["warning", "white"],
  ["info", "white"],
  ["ivory", "charcoal"],
  ["sand", "charcoal"],
  ["charcoal", "gold-400"],
];

// Borders and focus rings that must be visible against their surface.
const uiPairs: Array<[string, string]> = [
  ["stone-700", "white"], // form field border
  ["charcoal", "ivory"], // focus ring on light
  ["charcoal", "white"],
  ["gold-400", "charcoal"], // focus ring on dark
  ["error", "white"], // field border in error state
];

describe("design tokens", () => {
  it("defines the full Virasat palette", () => {
    expect(Object.keys(tokens).sort()).toEqual(
      [
        "white",
        "ivory",
        "sand",
        "line",
        "charcoal",
        "stone-700",
        "crimson-50",
        "crimson-700",
        "crimson-800",
        "emerald-100",
        "emerald-700",
        "gold-400",
        "gold-500",
        "gold-700",
        "error",
        "warning",
        "info",
      ].sort(),
    );
  });

  it.each(textPairs)("%s text on %s meets 4.5:1", (fg, bg) => {
    expect(contrast(colour(fg), colour(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)("%s on %s meets 3:1 for UI boundaries", (fg, bg) => {
    expect(contrast(colour(fg), colour(bg))).toBeGreaterThanOrEqual(3);
  });

  // Documents why these pairs are banned, so nobody "fixes" a design by using them.
  it("keeps gold-500 and line out of text and field borders", () => {
    expect(contrast(colour("gold-500"), colour("ivory"))).toBeLessThan(4.5);
    expect(contrast(colour("gold-700"), colour("sand"))).toBeLessThan(4.5);
    expect(contrast(colour("line"), colour("white"))).toBeLessThan(3);
  });
});
