import { ExtendedBounty } from "@marksman/contracts";
import { renderMods } from "../Bounty";

export default function ModsRequirement({
  bounty,
}: {
  bounty: ExtendedBounty;
}) {
  return (
    <>
      {bounty.goal.modRequirement.rule === "any" ? (
        <p>Any mod combination can be used for completion</p>
      ) : null}
      {bounty.goal.modRequirement.rule === "exact" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Used mods must be </p>
            <p className="text-yellow-200">exactly</p>
            <p>the following:</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "lg")}</div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "includes" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Used mods must </p>
            <p className="text-blue-300">include</p>
            <p>the following:</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "lg")}</div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "excludes" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Some mods must be</p>
            <p className="text-red-300">excluded</p>
            <p>to qualify</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "lg")}</div>
        </div>
      ) : null}
    </>
  );
}
