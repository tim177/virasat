import Link from "next/link";
import type { ComponentProps } from "react";

import { buttonClasses, type ButtonStyleOptions } from "./button-styles";

type ButtonLinkProps = ComponentProps<typeof Link> & Omit<ButtonStyleOptions, "className">;

/** A link that looks like a button. Use it when the action navigates to another page. */
export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link {...rest} className={buttonClasses({ variant, size, fullWidth, className })} />;
}
