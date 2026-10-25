const sizes = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

const variants = {
  primary: "border-transparent bg-surface hover:bg-surface-hover",
  accent: "border-transparent bg-accent text-on-accent hover:bg-accent-hover",
  danger: "border-danger text-danger hover:bg-danger hover:text-background",
  confirm: "border-success text-success hover:bg-success hover:text-background",
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
    variants[variant],
  ].join(" ");
}
