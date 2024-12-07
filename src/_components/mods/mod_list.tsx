import { Mod } from "@models/score";
import { ReactNode } from "react";
import ModIcon from "./mod_icon";

export default function ModList({
  mods,
  direction,
  width,
}: {
  mods: Mod[];
  direction: "col" | "row";
  width: string;
}) {
  let nodes: ReactNode[] = [];
  let flex_dir = "flex-" + direction;
  let space_dir = direction == "row" ? "space-x-1" : "space-y-1";
  mods.forEach((mod) =>
    nodes.push(<ModIcon mod={mod} width={width} key={mod} />)
  );
  return (
    <div
      className={`flex ${flex_dir} ${space_dir} place-content-center items-center`}
    >
      {nodes}
    </div>
  );
}
