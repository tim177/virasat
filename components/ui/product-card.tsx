import Link from "next/link";

import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

import { Badge } from "./badge";
import { Jaali } from "./ornament";
import { Price } from "./price";
import { StaticImage } from "./static-image";

export type ProductCardData = {
  href: string;
  title: string;
  /** Short line under the title, e.g. "Silk · Zardozi". */
  subtitle?: string;
  image?: { src: string; alt: string } | null;
  priceCents: number;
  compareAtCents?: number;
  badge?: string;
};

/** Product tile for grids. The whole card is one link (a 44px+ target). */
export function ProductCard({
  product,
  priority = false,
  className,
}: {
  product: ProductCardData;
  /** High-priority loading: set on the first visible card only, when it is likely the largest image on screen. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-card",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-(--focus-ring)",
        className,
      )}
    >
      <div className="relative aspect-3/4 overflow-hidden rounded-card">
        {product.image ? (
          <StaticImage
            src={product.image.src}
            alt={product.image.alt}
            fill
            loading={priority ? "eager" : undefined}
            fetchPriority={priority ? "high" : undefined}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="bg-jaali object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <Jaali label={en.ui.noPhoto} className="size-full" />
        )}
        {product.badge ? (
          <Badge tone="neutral" className="absolute top-3 left-3">
            {product.badge}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-medium">
          <Link
            href={product.href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.title}
          </Link>
        </h3>
        {product.subtitle ? (
          <p className="text-body-sm text-stone-700">{product.subtitle}</p>
        ) : null}
        <Price cents={product.priceCents} compareAtCents={product.compareAtCents} />
      </div>
    </article>
  );
}
