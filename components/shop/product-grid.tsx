import { ProductCard, type ProductCardData } from "@/components/ui/product-card";
import { cn } from "@/lib/cn";

/** Responsive product grid: 2 columns on phones, 3 on tablets, 4 on desktops. */
export function ProductGrid({
  products,
  priorityFirst = false,
  className,
}: {
  products: ProductCardData[];
  /** Load the first photo at high priority when the grid is at the top of the page. */
  priorityFirst?: boolean;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6",
        className,
      )}
    >
      {products.map((product, index) => (
        <li key={product.href}>
          <ProductCard product={product} priority={priorityFirst && index === 0} />
        </li>
      ))}
    </ul>
  );
}
