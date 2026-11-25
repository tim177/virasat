"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

import { IconButton } from "./icon-button";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { Jaali } from "./ornament";

export type GalleryImage = { src: string; alt: string };

/** Product photo gallery: one large photo, previous/next buttons and a row of thumbnails. */
export function Gallery({
  images,
  title,
  priorityFirst = false,
  className,
}: {
  images: GalleryImage[];
  /** Product title, used to label the gallery for screen readers. */
  title: string;
  /** Load the first photo at high priority: it is the largest element on the product page. */
  priorityFirst?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  if (total === 0) {
    return <Jaali label={en.ui.noPhoto} className={cn("aspect-3/4 rounded-card", className)} />;
  }

  const current = images[Math.min(index, total - 1)];
  const go = (next: number) => setIndex((next + total) % total);

  return (
    <section aria-label={en.ui.photosOf(title)} className={cn("flex flex-col gap-3", className)}>
      <div className="relative aspect-3/4 overflow-hidden rounded-card">
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          fill
          loading={priorityFirst && index === 0 ? "eager" : undefined}
          fetchPriority={priorityFirst && index === 0 ? "high" : undefined}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="bg-jaali object-cover"
        />
        {total > 1 ? (
          <>
            <IconButton
              label={en.ui.previousImage}
              tone="secondary"
              onClick={() => go(index - 1)}
              className="absolute top-1/2 left-3 -translate-y-1/2"
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              label={en.ui.nextImage}
              tone="secondary"
              onClick={() => go(index + 1)}
              className="absolute top-1/2 right-3 -translate-y-1/2"
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        ) : null}
      </div>

      {/* Announces the new position after previous/next. */}
      <p aria-live="polite" className="sr-only">
        {en.ui.imagePosition(index + 1, total)}
      </p>

      {total > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, i) => (
            <li key={image.src} className="shrink-0">
              <button
                type="button"
                aria-label={en.ui.showImage(i + 1, total)}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  "relative block h-20 w-15 overflow-hidden rounded-card border-2 transition-colors duration-150",
                  i === index ? "border-charcoal" : "border-transparent hover:border-line",
                )}
              >
                <Image src={image.src} alt="" fill sizes="60px" className="bg-jaali object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
