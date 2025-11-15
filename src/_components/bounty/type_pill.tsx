import { BountyType } from "@/src/_models/bounty";

export function bountyTypeColors(type: BountyType): {
  bg_color: string;
  border_color: string;
} {
  let bg_color = "";
  let border_color = "";
  switch (type) {
    case "FC":
      bg_color = "bg-green-700";
      border_color = "border-green-600";
      break;
    case "Clear":
      bg_color = "bg-blue-700";
      border_color = "border-blue-600";
      break;
  }

  return {
    bg_color,
    border_color,
  };
}

export default function BountyTypePill({
  type,
  selected,
  clickAction,
  grayed,
}: {
  type: BountyType;
  selected?: boolean;
  clickAction?: any;
  grayed?: boolean;
}) {
  let bg_color = bountyTypeColors(type).bg_color;
  let text = "";

  switch (type) {
    case "FC":
      text += "Full Combo";
      break;
    case "Clear":
      text += "Clear";
      break;
  }

  return (
    <p
      className={`shadow-lg select-none text-[2vw] md:text-xs font-extrabold rounded-lg md:p-1 px-1 md:px-3 ${bg_color} ${
        selected ? "border-2 border-green-400" : ""
      } ${clickAction ? "cursor-pointer" : ""} ${
        grayed ? "brightness-50" : ""
      }`}
      onClick={clickAction}
    >
      {text}
    </p>
  );
}
