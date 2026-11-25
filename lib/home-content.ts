import type { Occasion } from "@/lib/generated/prisma/enums";

// Home page content that isn't text (text lives in lib/i18n/en.ts under `home`).
// Edit this file to change the hero photo or the occasions shown. No CMS in v1.

export const homeHero = {
  // Sample artwork until the photoshoot; replace with a real hero photo (3:4 portrait).
  image: {
    src: "/seed/crimson-silk-bridal-lehenga-1.webp",
    alt: "Sample artwork of a crimson bridal lehenga in an arched frame",
  },
  primaryHref: "/c/lehengas",
  secondaryHref: "#custom-fit",
};

export const homeOccasions: Occasion[] = ["wedding", "sangeet", "mehendi", "reception", "festive"];
