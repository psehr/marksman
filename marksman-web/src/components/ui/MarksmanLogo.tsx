import { aes_font } from "@/lib/fonts";
import TargetIcon from "./TargetIcon";

export default function MarksmanLogo() {
  return (
    <div
      className={`flex items-center gap-2 bg-linear-to-br from-transparent to-background shadow border-border rounded border p-2 px-4`}
    >
      <span className={`text-xl font-bold text-accent ${aes_font.className}`}>
        MARKSMAN
      </span>
      <TargetIcon />
    </div>
  );
}
