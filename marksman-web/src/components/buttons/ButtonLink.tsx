import { ComponentProps } from "react";
import { ButtonSize, buttonStyles, ButtonVariant } from "./buttonStyles";
import Link from "next/link";

type ButtonLinkProps = ComponentProps<typeof Link> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export default function ButtonLink({
  children,
  size = "md",
  variant = "primary",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={`${buttonStyles(size, variant)} ${className}`}>
      {children}
    </Link>
  );
}
