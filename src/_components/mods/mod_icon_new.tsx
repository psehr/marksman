import { Mod } from "@/src/_models/score";
import Image from "next/image";

import dt from "@static/mod_icons_new/dt.svg";
import ez from "@static/mod_icons_new/ez.svg";
import fl from "@static/mod_icons_new/fl.svg";
import hd from "@static/mod_icons_new/hd.svg";
import hr from "@static/mod_icons_new/hr.svg";
import ht from "@static/mod_icons_new/ht.svg";
import nc from "@static/mod_icons_new/nc.svg";
import nf from "@static/mod_icons_new/nf.svg";
import pf from "@static/mod_icons_new/pf.svg";
import sd from "@static/mod_icons_new/sd.svg";
import nm from "@static/mod_icons_new/nm.svg";

export default function ModIconNew(props: {
  mod: Mod;
  sizes: string;
  grayed?: boolean;
}) {
  let selectedModFile;
  switch (props.mod) {
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
    case "nm":
      selectedModFile = nm;
      break;
    default:
      selectedModFile = dt;
      break;
  }
  return (
    <div
      className={
        props.grayed ? "brightness-50" : "" + " relative flex " + props.sizes
      }
    >
      <Image src={selectedModFile} alt="" fill />
    </div>
  );
}
