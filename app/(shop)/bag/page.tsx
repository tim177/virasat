import type { Metadata } from "next";

import { BagView } from "@/components/bag/bag-view";
import { en } from "@/lib/i18n/en";

export const metadata: Metadata = {
  title: en.bag.title,
  robots: { index: false, follow: false },
};

export default function BagPage() {
  return (
    <div className="page-container flex flex-col gap-8 py-8 md:py-12">
      <h1 className="font-display text-h1">{en.bag.title}</h1>
      <BagView />
    </div>
  );
}
