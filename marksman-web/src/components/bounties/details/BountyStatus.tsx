import { ExtendedBounty } from "@marksman/contracts";

export default function BountyStatus({ bounty }: { bounty: ExtendedBounty }) {
  let text_color: string = "text-accent";
  let text: string = "OPEN";

  switch (bounty.status) {
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
    <p className={`w-full bg-card shadow-md rounded py-2 ${text_color}`}>
      {text}
    </p>
  );
}
