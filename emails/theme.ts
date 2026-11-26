// Email clients ignore our CSS, so emails use inline styles. These values mirror the design
// tokens in app/globals.css; keep them in sync if a token changes.

export const emailColors = {
  ivory: "#FBF8F3",
  white: "#FFFFFF",
  sand: "#F3EDE3",
  line: "#E6DED1",
  charcoal: "#1F1B19",
  stone700: "#5F5751",
  crimson700: "#7B1E2B",
  emerald700: "#0F4C3A",
  gold500: "#C9A45C",
} as const;

export const emailFonts = {
  display: "'Playfair Display', Georgia, 'Times New Roman', serif",
  body: "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;
