import { ButtonLink } from "@/components/ui/button-link";
import { ZariRule } from "@/components/ui/ornament";
import { en } from "@/lib/i18n/en";

// Shown when a shop page calls notFound() (unknown product or category).
// With Cache Components the response may already have started as 200; Next.js then adds
// <meta name="robots" content="noindex"> so search engines still drop the page.
export default function ShopNotFound() {
  return (
    <div className="page-container flex flex-1 flex-col items-center justify-center gap-6 py-20 text-center">
      <div aria-hidden="true" className="h-28 w-20 rounded-arch bg-jaali" />
      <h1 className="font-display text-h1">{en.notFound.title}</h1>
      <ZariRule className="w-40" />
      <p className="max-w-md text-stone-700">{en.notFound.text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop">{en.notFound.shop}</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          {en.notFound.home}
        </ButtonLink>
      </div>
    </div>
  );
}
