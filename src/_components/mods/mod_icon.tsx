import { Mod } from "@models/score";
import Image from "next/image";
import dt from "@static/mod_icons/dt.png";
import ez from "@static/mod_icons/ez.png";
import fl from "@static/mod_icons/fl.png";
import hd from "@static/mod_icons/hd.png";
import hr from "@static/mod_icons/hr.png";
import ht from "@static/mod_icons/ht.png";
import nc from "@static/mod_icons/nc.png";
import nf from "@static/mod_icons/nf.png";
import pf from "@static/mod_icons/pf.png";
import sd from "@static/mod_icons/sd.png";
import so from "@static/mod_icons/so.png";

export default function ModIcon({
  mod,
  width,
  grayed,
  clickAction,
}: {
  mod: Mod;
  width: string;
  grayed?: boolean;
  clickAction?: any;
}) {
  let selectedModFile;
  switch (mod) {
    case "dt":
      selectedModFile = dt;
      break;
    case "ez":
      selectedModFile = ez;
      break;
    case "fl":
      selectedModFile = fl;
      break;
    case "hd":
      selectedModFile = hd;
      break;
    case "hr":
      selectedModFile = hr;
      break;
    case "ht":
      selectedModFile = ht;
      break;
    case "nc":
      selectedModFile = nc;
      break;
    case "nf":
      selectedModFile = nf;
      break;
    case "pf":
      selectedModFile = pf;
      break;
    case "sd":
      selectedModFile = sd;
      break;
    case "so":
      selectedModFile = so;
      break;
    default:
      selectedModFile = dt;
      break;
  }
  return (
    <div
      className={`select-none flex ${width} ${
        grayed ? "brightness-[40%]" : ""
      } ${clickAction ? "cursor-pointer" : ""}`}
      onClick={clickAction}
    >
      <Image
        alt="mod icon"
        src={selectedModFile}
        key={mod}
        width={44}
        height={31}
        className="shadow-lg"
      />
    </div>
  );
}
