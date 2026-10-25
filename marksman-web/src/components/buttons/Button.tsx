"use client";

import { ComponentProps } from "react";
import { ButtonSize, buttonStyles, ButtonVariant } from "./buttonStyles";

type ButtonProps = ComponentProps<"button"> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export default function Button({
  children,
  size = "md",
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`${buttonStyles(size, variant)} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
