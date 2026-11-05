import { aes_font } from "@/lib/fonts";

const sizes = {
  sm: "h-8 px-3 gap-1.5",
  md: "h-10 px-4 gap-2",
  lg: "h-12 px-6 gap-2",
};

const textSizes = { sm: "text-sm", md: "text-sm", lg: "text-base" };
const textualTextSizes = { sm: "text-lg", md: "text-xl", lg: "text-2xl" };

const variants = {
  primary: "border-transparent bg-surface hover:bg-surface-hover",
  accent: "border-transparent bg-accent text-on-accent hover:bg-accent-hover",
  danger: "border-danger text-danger hover:bg-danger hover:text-background",
  confirm: "border-success text-success hover:bg-success hover:text-background",
  outline:
    "border-border bg-surface-raised text-foreground hover:bg-surface-hover",
  textual: `border-transparent aria-pressed:text-accent text-foreground-muted font-bold ${aes_font.className}`,
};

export type ButtonSize = keyof typeof sizes;
export type ButtonVariant = keyof typeof variants;

export function buttonStyles(
  size: ButtonSize = "md",
  variant: ButtonVariant = "primary",
) {
  return [
    "whitespace-nowrap shrink-0",
    "inline-flex items-center justify-center rounded border cursor-pointer",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
    sizes[size],
    variant === "textual" ? textualTextSizes[size] : textSizes[size],
    variants[variant],
  ].join(" ");
}
