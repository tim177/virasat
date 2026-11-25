import Link from "next/link";
import { Suspense } from "react";

import { ProductGrid } from "@/components/shop/product-grid";
import { ButtonLink } from "@/components/ui/button-link";
import { Jaali, ZariRule } from "@/components/ui/ornament";
import { Skeleton } from "@/components/ui/skeleton";
import { StaticImage } from "@/components/ui/static-image";
import { categories, categoryByValue, occasionLabels } from "@/lib/catalog";
import { homeHero, homeOccasions } from "@/lib/home-content";
import { en } from "@/lib/i18n/en";
import { getCategoryCovers, getNewestProducts } from "@/lib/products";

const t = en.home;

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />

      <section aria-labelledby="home-categories" className="page-container py-14 md:py-20">
        <SectionHeading id="home-categories">{t.categoriesTitle}</SectionHeading>
        <Suspense fallback={<ArchSkeletons />}>
          <CategoryArches />
        </Suspense>
      </section>

      <section aria-labelledby="home-occasions" className="page-container pb-14 md:pb-20">
        <SectionHeading id="home-occasions">{t.occasionsTitle}</SectionHeading>
        <ul className="flex flex-wrap justify-center gap-3">
          {homeOccasions.map((occasion) => (
            <li key={occasion}>
              <Link
                href={`/shop?occasion=${occasion}`}
                className="inline-flex min-h-11 items-center rounded-pill border border-charcoal bg-white px-6 font-display text-body-lg transition-colors duration-150 hover:bg-charcoal hover:text-white"
              >
                {occasionLabels[occasion]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-new" className="page-container pb-14 md:pb-20">
        <SectionHeading id="home-new">{t.newArrivalsTitle}</SectionHeading>
        <Suspense fallback={<GridSkeleton />}>
          <NewArrivals />
        </Suspense>
        <div className="mt-10 flex justify-center">
          <ButtonLink href="/shop" variant="secondary">
            {t.viewAll}
          </ButtonLink>
        </div>
      </section>

      <CustomFit />
    </>
  );
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <div className="mb-8 flex flex-col items-center gap-4 text-center md:mb-10">
      <h2 id={id} className="font-display text-h2 md:text-h1">
        {children}
      </h2>
      <ZariRule className="w-40" />
    </div>
  );
}

function Hero() {
  return (
    <section className="page-container grid items-center gap-10 py-10 md:grid-cols-2 md:py-16 lg:gap-16">
      <div className="flex flex-col gap-6">
        <p className="text-caption font-medium tracking-widest text-gold-700 uppercase">
          {t.heroEyebrow}
        </p>
        <h1 className="font-display text-h1 md:text-display-2 lg:text-display-1">
          {t.heroTitle} <em className="text-crimson-700">{t.heroTitleEmphasis}</em>
        </h1>
        <ZariRule className="max-w-xs" />
        <p className="max-w-lg text-body-lg text-stone-700">{t.heroText}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={homeHero.primaryHref} size="lg">
            {t.heroPrimary}
          </ButtonLink>
          <ButtonLink href={homeHero.secondaryHref} size="lg" variant="secondary">
            {t.heroSecondary}
          </ButtonLink>
        </div>
      </div>
      <div className="relative mx-auto aspect-3/4 w-full max-w-md overflow-hidden rounded-arch bg-jaali shadow-raised">
        <StaticImage
          src={homeHero.image.src}
          alt={homeHero.image.alt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 768px) 28rem, 90vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section aria-label={t.trustLabel} className="border-y border-line bg-white">
      <ul className="page-container grid grid-cols-1 gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {t.trust.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-2 size-2 shrink-0 rotate-45 bg-gold-500" />
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-body-sm text-stone-700">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function CategoryArches() {
  const covers = await getCategoryCovers();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {covers.map(({ category, imageUrl }) => {
        const info = categoryByValue(category);
        return (
          <li key={category}>
            <Link href={`/c/${info.slug}`} className="group flex flex-col items-center gap-3">
              <div className="relative aspect-3/4 w-full overflow-hidden rounded-arch">
                {imageUrl ? (
                  <StaticImage
                    src={imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
                    className="bg-jaali object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <Jaali className="size-full" />
                )}
              </div>
              <span className="font-display text-h3 underline-offset-4 group-hover:underline">
                {info.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function NewArrivals() {
  const products = await getNewestProducts(4);
  return <ProductGrid products={products} />;
}

function CustomFit() {
  return (
    <section id="custom-fit" aria-labelledby="home-custom-fit" className="scroll-mt-28 bg-sand">
      <div className="page-container grid gap-10 py-14 md:grid-cols-2 md:py-20">
        <div className="flex flex-col gap-5">
          <h2 id="home-custom-fit" className="font-display text-h2 md:text-h1">
            {t.customFitTitle}
          </h2>
          <ZariRule className="max-w-xs" />
          <p className="max-w-md text-body-lg">{t.customFitText}</p>
          <div>
            <ButtonLink href="/shop">{t.customFitCta}</ButtonLink>
          </div>
        </div>
        <ol className="flex flex-col gap-6">
          {t.customFitSteps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-14 w-11 shrink-0 items-end justify-center rounded-arch bg-crimson-700 pb-2 font-display text-h3 text-white"
              >
                {index + 1}
              </span>
              <div>
                <p className="font-display text-h3">{step.title}</p>
                <p className="text-stone-700">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ArchSkeletons() {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <p className="sr-only">{en.ui.loading}</p>
      {categories.map((c) => (
        <Skeleton key={c.value} className="aspect-3/4 rounded-arch" />
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
    >
      <p className="sr-only">{en.ui.loading}</p>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-3/4" />
      ))}
    </div>
  );
}
