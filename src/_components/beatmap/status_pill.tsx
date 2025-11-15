import { BeatmapStatus } from "@models/beatmap";

export function statusBgColor(status: BeatmapStatus) {
  let color = "bg-green-400";
  switch (status) {
    case "ranked":
      color = "bg-green-400";
      break;
    case "loved":
      color = "bg-pink-400";
      break;
    case "qualified":
      color = "bg-blue-400";
      break;
    case "approved":
      color = "bg-green-400";
      break;
    case "pending":
      color = "bg-yellow-400";
      break;
    case "wip":
      color = "bg-orange-400";
      break;
    case "graveyard":
      color = "bg-slate-900";
      break;
  }
  return color;
}

export function StatusPill({ status }: { status: BeatmapStatus }) {
  const bg_color = statusBgColor(status);
  let text = "RANKED";
  switch (status) {
    case "ranked":
      text = "RANKED";
      break;
    case "loved":
      text = "LOVED";
      break;
    case "qualified":
      text = "QUALIFIED";
      break;
    case "approved":
      text = "APPROVED";
      break;
    case "pending":
      text = "PENDING";
      break;
    case "wip":
      text = "WIP";
      break;
    case "graveyard":
      text = "GRAVEYARD";
      break;
  }

  return (
    <p
      className={`text-[2vw] md:text-xs font-extrabold shadow-lg rounded-lg md:p-1 px-1 md:px-3 ${bg_color} ${
        status != "graveyard" ? "text-gray-700" : "text-gray-400"
      }`}
    >
      {text}
    </p>
  );
}
