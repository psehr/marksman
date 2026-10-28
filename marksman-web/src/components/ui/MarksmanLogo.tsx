import { aes_font } from "@/lib/fonts";
import TargetIcon from "./TargetIcon";

export default function MarksmanLogo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const large = size === "lg";
  return (
    <span
      className={`flex items-center ${large ? "gap-3 sm:gap-5" : "gap-2 bg-linear-to-br from-transparent to-background shadow border-border rounded border p-2 px-4"}`}
    >
      <span className={`${large ? "text-4xl sm:text-6xl lg:text-7xl" : "text-xl"} font-bold text-accent ${aes_font.className}`}>
        MARKSMAN
      </span>
      <TargetIcon size={large ? "hero" : "md"} />
    </span>
  );
}
