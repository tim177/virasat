import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Accordion } from "@/components/ui/accordion";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Checkbox, RadioGroup } from "@/components/ui/choice";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Gallery } from "@/components/ui/gallery";
import { IconButton } from "@/components/ui/icon-button";
import { BagIcon, CloseIcon, SearchIcon } from "@/components/ui/icons";
import { Jaali, ZariRule } from "@/components/ui/ornament";
import { Price } from "@/components/ui/price";
import { ProductCard, type ProductCardData } from "@/components/ui/product-card";
import { Stepper, Timeline } from "@/components/ui/progress";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

import { DialogDemo, LoadingButtonDemo, ToastDemo } from "./demos";

// Design-system preview. Always on in development; on a production build only when
// ENABLE_DEV_PAGES=true (CI sets it so the accessibility tests can run). Never set it on the
// live server.
export const metadata: Metadata = {
  title: "Design system · Virasat",
  robots: { index: false, follow: false },
};

const colours = [
  { name: "Crimson 700", className: "bg-crimson-700", use: "Primary action" },
  { name: "Crimson 800", className: "bg-crimson-800", use: "Primary hover" },
  { name: "Crimson 50", className: "bg-crimson-50", use: "Accent background" },
  { name: "Emerald 700", className: "bg-emerald-700", use: "Trust, success" },
  { name: "Emerald 100", className: "bg-emerald-100", use: "Success background" },
  { name: "Gold 400", className: "bg-gold-400", use: "Call to action on dark" },
  { name: "Gold 500", className: "bg-gold-500", use: "Ornament only" },
  { name: "Gold 700", className: "bg-gold-700", use: "Gold text on light" },
  { name: "Charcoal", className: "bg-charcoal", use: "Text" },
  { name: "Stone 700", className: "bg-stone-700", use: "Secondary text, field borders" },
  { name: "Line", className: "bg-line", use: "Dividers" },
  { name: "Sand", className: "bg-sand", use: "Soft surface" },
  { name: "Ivory", className: "bg-ivory", use: "Page ground" },
  { name: "White", className: "bg-white", use: "Surfaces" },
  { name: "Error", className: "bg-error", use: "Errors" },
  { name: "Warning", className: "bg-warning", use: "Warnings" },
  { name: "Info", className: "bg-info", use: "Information" },
];

const sampleProducts: ProductCardData[] = [
  {
    href: "/p/crimson-silk-lehenga",
    title: "Crimson silk lehenga",
    subtitle: "Silk · Zardozi",
    image: { src: "/dev/sample-1.svg", alt: "Crimson silk lehenga on a mannequin" },
    priceCents: 64900,
    badge: "Custom fit available",
  },
  {
    href: "/p/emerald-anarkali",
    title: "Emerald georgette anarkali",
    subtitle: "Georgette · Gota patti",
    image: { src: "/dev/sample-2.svg", alt: "Emerald anarkali with gold border" },
    priceCents: 32900,
    compareAtCents: 38900,
  },
  {
    href: "/p/ivory-sherwani",
    title: "Ivory raw-silk sherwani",
    subtitle: "Raw silk · Resham",
    image: null,
    priceCents: 49900,
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-line pt-8">
      <h2 className="font-display text-h2">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_PAGES !== "true") {
    notFound();
  }

  return (
    <div className="page-container flex flex-col gap-12 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-h1">Design system</h1>
        <p className="max-w-2xl text-stone-700">
          Every Virasat component in one place. Check each one by keyboard (Tab, Enter, Space,
          Escape) and at 360px width.
        </p>
      </header>

      <Section title="Colours">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {colours.map((colour) => (
            <li key={colour.name} className="flex flex-col gap-2">
              <div className={`h-16 rounded-card border border-line ${colour.className}`} />
              <p className="text-body-sm font-medium">{colour.name}</p>
              <p className="text-caption text-stone-700">{colour.use}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <p className="font-display text-h1 md:text-display-1">Display 72</p>
          <p className="font-display text-h2 md:text-display-2">Display 56</p>
          <p className="font-display text-h1">Heading 40</p>
          <p className="font-display text-h2">
            Heading 32 with <em>italic emphasis</em>
          </p>
          <p className="font-display text-h3">Heading 24</p>
          <p className="text-body-lg">Body 18: made to your measurements in Jaipur.</p>
          <p className="text-body">Body 16: duties and taxes are included in every price.</p>
          <p className="text-body-sm">Body 14: free express shipping to the US.</p>
          <p className="text-caption">Caption 12: arrives in 4–7 business days.</p>
          <p className="text-gold-700">Gold 700 text, only on white or ivory.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link style</Button>
          <Button size="lg">Large primary</Button>
          <Button disabled>Disabled</Button>
          <LoadingButtonDemo />
          <ButtonLink href="/" variant="secondary">
            Button-style link
          </ButtonLink>
        </div>
        <div className="surface-dark flex flex-wrap items-center gap-3 rounded-card bg-charcoal p-6">
          <Button variant="gold">Gold on dark</Button>
          <IconButton label="Close" tone="onDark">
            <CloseIcon />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IconButton label="Search">
            <SearchIcon />
          </IconButton>
          <IconButton label="Bag" tone="secondary">
            <BagIcon />
          </IconButton>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-3xl gap-6 md:grid-cols-2">
          <Input label="Full name" autoComplete="name" />
          <Input label="Email" type="email" help="We'll send your order updates here." />
          <Input
            label="Bust"
            inputMode="decimal"
            defaultValue="2"
            error="Bust must be between 28 and 56 inches."
          />
          <Input label="Company" optional />
          <Select
            label="Size"
            placeholder="Choose a size"
            options={[
              { value: "s", label: "S (US 4–6)" },
              { value: "m", label: "M (US 8–10)" },
              { value: "l", label: "L (US 12–14)" },
            ]}
          />
          <Textarea label="Notes for the tailor" optional />
          <Checkbox
            label="Save these measurements"
            description="Use them again for your next order."
          />
          <RadioGroup
            legend="Fit"
            name="fit"
            defaultValue="standard"
            options={[
              { value: "standard", label: "Standard size" },
              {
                value: "custom",
                label: "Custom fit",
                description: "+$45, made to your measurements",
              },
              { value: "semi", label: "Semi-stitched", disabled: true },
            ]}
          />
        </div>
      </Section>

      <Section title="Badges, status and price">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="accent">New</Badge>
          <Badge tone="success">In stock</Badge>
          <Badge tone="warning">Only 2 left</Badge>
          <Badge tone="error">Sold out</Badge>
          <Badge tone="info">Made to order</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success" label="Paid" />
          <StatusPill tone="info" label="In production" />
          <StatusPill tone="warning" label="Awaiting fit call" />
          <StatusPill tone="error" label="Cancelled" />
          <StatusPill label="Delivered" />
        </div>
        <div className="flex flex-wrap items-baseline gap-6">
          <Price cents={64900} />
          <Price cents={32900} compareAtCents={38900} />
          <Price cents={124000} size="lg" />
        </div>
      </Section>

      <Section title="Product cards">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
          {sampleProducts.map((product, index) => (
            <ProductCard key={product.href} product={product} preloadImage={index === 0} />
          ))}
        </div>
      </Section>

      <Section title="Gallery">
        <Gallery
          className="max-w-md"
          title="Crimson silk lehenga"
          images={[
            { src: "/dev/sample-1.svg", alt: "Front view of the crimson lehenga" },
            { src: "/dev/sample-2.svg", alt: "Detail of the zardozi border" },
            { src: "/dev/sample-3.svg", alt: "Back view of the blouse" },
          ]}
        />
      </Section>

      <Section title="Accordion">
        <Accordion
          className="max-w-2xl"
          items={[
            {
              title: "Details",
              content: "Pure silk lehenga with hand zardozi work.",
              defaultOpen: true,
            },
            { title: "Care", content: "Dry clean only. Store in a muslin bag." },
            { title: "Shipping & returns", content: "Free express shipping. Duties included." },
          ]}
        />
      </Section>

      <Section title="Modal, drawer and toast">
        <DialogDemo />
        <ToastDemo />
      </Section>

      <Section title="Navigation">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Lehengas", href: "/c/lehengas" },
            { label: "Crimson silk lehenga" },
          ]}
        />
        <Stepper steps={["Design", "Blouse", "Lehenga", "Review"]} current={1} />
      </Section>

      <Section title="Order timeline">
        <Timeline
          className="max-w-md"
          items={[
            { label: "Paid", state: "complete", date: "Mar 3, 2027" },
            {
              label: "Confirmed",
              state: "complete",
              date: "Mar 4, 2027",
              description: "Fit call done.",
            },
            { label: "In production", state: "current", date: "Started Mar 5, 2027" },
            { label: "Shipped", state: "upcoming" },
            { label: "Delivered", state: "upcoming" },
          ]}
        />
      </Section>

      <Section title="Empty, loading and ornaments">
        <EmptyState
          headingLevel={3}
          title="Your bag is empty"
          description="Explore lehengas, sarees and sherwanis made for your celebrations."
          action={<ButtonLink href="/">Start shopping</ButtonLink>}
        />
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/4]" />
            <SkeletonText lines={2} />
          </div>
          <div className="flex flex-col gap-3">
            <Jaali label="Photo coming soon" className="aspect-[3/4] rounded-card" />
            <div className="aspect-[3/4] rounded-arch bg-jaali" aria-hidden="true" />
          </div>
        </div>
        <ZariRule className="max-w-md" />
      </Section>
    </div>
  );
}
