import { ExtendedBounty } from "@marksman/contracts";
import { renderMods } from "../bounty_views/BountyCard";
import { aes_font } from "@/lib/fonts";

export default function ModsRequirement({
  bounty,
}: {
  bounty: ExtendedBounty;
}) {
  return (
    <div className={`${aes_font.className} font-bold`}>
      {bounty.goal.modRequirement.rule === "any" ? (
        <p>Any mod combination can be used for completion</p>
      ) : null}
      {bounty.goal.modRequirement.rule === "exact" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Used mods must be </p>
            <p className="text-accent">exactly</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "md")}</div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "includes" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Mods must </p>
            <p className="text-accent">include</p>
            <p>the following:</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "md")}</div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "excludes" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Some mods must be</p>
            <p className="text-accent">excluded</p>
            <p>to qualify:</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "md")}</div>
        </div>
      ) : null}
    </div>
  );
}
