import type { Metadata } from "next";
import type { ReactNode } from "react";

import { en } from "@/lib/i18n/en";

export const metadata: Metadata = {
  title: { default: en.admin.metaTitle, template: "%s · Virasat admin" },
  robots: { index: false, follow: false },
};

// Admin pages check the session on the server for every request, so navigations wait for
// the server instead of showing a prefetched shell (no instant-navigation checks here).
export const instant = false;

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col bg-ivory">{children}</div>;
}
