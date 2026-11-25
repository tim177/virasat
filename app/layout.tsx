import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import { en } from "@/lib/i18n/en";
import { allowIndexing, siteUrl } from "@/lib/site-url";

import "./globals.css";

// Both are variable fonts: one file per style covers every weight we use (400–600).
// Only the body font is preloaded; the heading font loads right after without competing with
// the main product photo, and its size-matched fallback keeps the layout from shifting.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: en.seo.homeTitle, template: "%s · Virasat" },
  description: en.seo.homeDescription,
  openGraph: { siteName: en.site.name, type: "website", locale: "en_US" },
  // Staging and local builds stay out of search engines (see robots.ts).
  robots: allowIndexing ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
