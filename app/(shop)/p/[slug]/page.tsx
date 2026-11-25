import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TrackEvent } from "@/components/analytics/track-event";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { ProductGrid } from "@/components/shop/product-grid";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Gallery } from "@/components/ui/gallery";
import { ZariRule } from "@/components/ui/ornament";
import { Price } from "@/components/ui/price";
import { categoryByValue, genderLabels, occasionLabels } from "@/lib/catalog";
import { en } from "@/lib/i18n/en";
import { centsToDecimalString } from "@/lib/money";
import { getProduct, getPublishedSlugs, getRelatedProducts } from "@/lib/products";
import { absoluteUrl } from "@/lib/site-url";

// Unknown slugs return 404. Cache Components needs at least one slug at build time, so an
// empty catalogue builds with a placeholder that also returns 404.
const PLACEHOLDER_SLUG = "__no-products__";

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.length > 0 ? slugs.map(({ slug }) => ({ slug })) : [{ slug: PLACEHOLDER_SLUG }];
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const image = product.images[0];
  return {
    title: product.title,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 160),
      images: image ? [{ url: absoluteUrl(image.url), alt: image.alt }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const category = categoryByValue(product.category);
  const related = await getRelatedProducts(product.category, product.slug);
  const inStock = product.variants.some((v) => v.stock === null || v.stock > 0);
  const onSale = product.compareAtCents !== null && product.compareAtCents > product.priceCents;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((image) => absoluteUrl(image.url)),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: en.site.name },
    material: product.fabric,
    color: product.colour,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/p/${product.slug}`),
      priceCurrency: "USD",
      price: centsToDecimalString(product.priceCents),
      availability:
        inStock || product.customFitAvailable
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <div className="page-container flex flex-col gap-14 py-6 md:py-10">
      <div className="flex flex-col gap-4">
        <Breadcrumbs
          items={[
            { label: en.ui.home, href: "/" },
            { label: category.label, href: `/c/${category.slug}` },
            { label: product.title },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <Gallery
            className="lg:col-span-7"
            title={product.title}
            images={product.images.map((image) => ({ src: image.url, alt: image.alt }))}
            priorityFirst
          />

          <div className="flex flex-col gap-6 lg:col-span-5">
            <div className="flex flex-col gap-2">
              <p className="text-caption font-medium tracking-widest text-gold-700 uppercase">
                {genderLabels[product.gender]} · {category.label}
              </p>
              <h1 className="font-display text-h2 md:text-h1">{product.title}</h1>
              <p className="text-stone-700">
                {product.fabric} · {product.work}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Price
                  size="lg"
                  cents={product.priceCents}
                  compareAtCents={product.compareAtCents ?? undefined}
                />
                {onSale ? <Badge tone="accent">{en.catalog.saleBadge}</Badge> : null}
                {product.customFitAvailable ? (
                  <Badge tone="neutral">{en.catalog.customFitBadge}</Badge>
                ) : null}
              </div>
              <p className="text-body-sm text-emerald-700">{en.product.priceNote}</p>
            </div>

            <ZariRule />

            <PurchasePanel
              slug={product.slug}
              gender={product.gender}
              priceCents={product.priceCents}
              sizes={product.variants.map((v) => ({ id: v.id, size: v.size, stock: v.stock }))}
              readyDays={product.readyDays}
              customFit={
                product.customFitAvailable && product.customDays
                  ? { extraCents: product.customFitExtraCents, days: product.customDays }
                  : null
              }
            />

            <Accordion
              items={[
                {
                  title: en.product.details,
                  defaultOpen: true,
                  content: (
                    <div className="flex flex-col gap-4">
                      <p>{product.description}</p>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-body-sm">
                        <dt className="font-medium text-charcoal">{en.product.fabric}</dt>
                        <dd>{product.fabric}</dd>
                        <dt className="font-medium text-charcoal">{en.product.work}</dt>
                        <dd>{product.work}</dd>
                        <dt className="font-medium text-charcoal">{en.product.colour}</dt>
                        <dd>{product.colour}</dd>
                        <dt className="font-medium text-charcoal">{en.product.occasions}</dt>
                        <dd>{product.occasions.map((o) => occasionLabels[o]).join(", ")}</dd>
                      </dl>
                    </div>
                  ),
                },
                { title: en.product.care, content: <p>{product.care}</p> },
                {
                  title: en.product.shippingReturns,
                  content: <p>{en.product.shippingReturnsText}</p>,
                },
              ]}
            />
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related" className="flex flex-col gap-6">
          <h2 id="related" className="font-display text-h2">
            {en.product.related}
          </h2>
          <ProductGrid products={related} />
        </section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <TrackEvent
        event="view_item"
        properties={{
          slug: product.slug,
          category: product.category,
          price_cents: product.priceCents,
        }}
      />
    </div>
  );
}
