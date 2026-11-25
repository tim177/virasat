import { getImageProps, type ImageProps } from "next/image";

/**
 * Same optimized, responsive output as next/image (srcset, WebP, lazy loading), rendered as a
 * plain <img> on the server. Unlike <Image>, it ships no client JavaScript and needs no
 * hydration, which matters on pages with many photos (grids, home page).
 * Use <Image> only when the image itself is interactive or inside a client component.
 */
export function StaticImage(props: ImageProps) {
  const { props: imgProps } = getImageProps(props);
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt comes from props
  return <img {...imgProps} />;
}
