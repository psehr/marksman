import { aes_font } from "@/lib/fonts";
import BPIcon from "../economy/BPIcon";

export default function StatContainer({
  stat,
  title,
  unit,
}: {
  stat: number;
  title: string;
  unit: "bp" | "count";
}) {
  return (
    <div className="flex flex-col place-content-center items-center">
      <div className="flex gap-2">
        <span
          className={`text-3xl text-accent font-bold ${aes_font.className}`}
        >
          {stat.toLocaleString()}
        </span>
        {unit === "bp" ? <BPIcon size="md" /> : null}
      </div>
      <p className="text-foreground-muted">{title}</p>
    </div>
  );
}
