import { aes_font } from "@/lib/fonts";
import { ExtendedBounty } from "@marksman/contracts";

export default function BountyStatus({
  status,
}: {
  status: ExtendedBounty["status"];
}) {
  let text_color: string = "text-accent";
  let text: string = "OPEN";

  switch (status) {
    case "open":
      text_color = "text-accent";
      text = "OPEN";
      break;
    case "completed":
      text_color = "text-success";
      text = "COMPLETED";
      break;
    case "cancelled":
      text_color = "text-danger";
      text = "CANCELLED";
      break;
  }

  return (
    <div className="flex w-full place-content-center items-center bg-surface border border-border rounded py-2">
      <p
        className={`font-bold text-4xl tracking-widest ${text_color} ${aes_font.className}`}
      >
        {text}
      </p>
    </div>
  );
}
