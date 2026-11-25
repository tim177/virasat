"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Gender } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";
import { menSizeChart, womenSizeChart } from "@/lib/size-guide";

const cell = "border-b border-line px-3 py-2 text-left tabular-nums";

function WomenTable() {
  const t = en.sizeGuide;
  return (
    <table className="w-full text-body-sm">
      <caption className="mb-2 text-left text-stone-700">{t.womenCaption}</caption>
      <thead>
        <tr>
          <th scope="col" className={`${cell} font-medium`}>
            {t.size}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            US
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {t.bust}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {t.waist}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {t.hip}
          </th>
        </tr>
      </thead>
      <tbody>
        {womenSizeChart.map((row) => (
          <tr key={row.size}>
            <th scope="row" className={`${cell} font-medium`}>
              {row.size}
            </th>
            <td className={cell}>{row.us}</td>
            <td className={cell}>{row.bust}&Prime;</td>
            <td className={cell}>{row.waist}&Prime;</td>
            <td className={cell}>{row.hip}&Prime;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MenTable() {
  const t = en.sizeGuide;
  return (
    <table className="w-full text-body-sm">
      <caption className="mb-2 text-left text-stone-700">{t.menCaption}</caption>
      <thead>
        <tr>
          <th scope="col" className={`${cell} font-medium`}>
            {t.size}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {t.chest}
          </th>
          <th scope="col" className={`${cell} font-medium`}>
            {t.waist}
          </th>
        </tr>
      </thead>
      <tbody>
        {menSizeChart.map((row) => (
          <tr key={row.size}>
            <th scope="row" className={`${cell} font-medium`}>
              {row.size}
            </th>
            <td className={cell}>{row.chest}&Prime;</td>
            <td className={cell}>{row.waist}&Prime;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "Size guide" link-style button that opens the right size chart for the product. */
export function SizeGuideButton({ gender }: { gender: Gender }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="link" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {en.product.sizeGuide}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={en.sizeGuide.title}>
        <div className="flex flex-col gap-4">
          {gender === "men" ? <MenTable /> : <WomenTable />}
          <p className="text-body-sm text-stone-700">{en.sizeGuide.note}</p>
        </div>
      </Dialog>
    </>
  );
}
