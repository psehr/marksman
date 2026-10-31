import { aes_font } from "@/lib/fonts";
import { ComponentProps } from "react";

const sizes = {
  sm: "h-6 text-sm px-2",
  md: "h-8 text-md px-2",
  lg: "h-10 text-lg px-4",
  xl: "h-12 text-xl px-4",
};

export type TextInputSize = keyof typeof sizes;

type TextInputProps = Omit<ComponentProps<"input">, "size"> & {
  size?: TextInputSize;
};

export default function TextInput({
  size = "md",
  className = "",
  ...props
}: TextInputProps) {
  return (
    <input
      {...props}
      type="text"
      className={`${aes_font.className} ${sizes[size]} bg-background focus-visible:outline-accent flex w-full rounded-sm px-4 text-left font-bold focus-visible:outline-2 ${className}`}
    />
  );
}
