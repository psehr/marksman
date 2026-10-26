import { ExtendedBounty } from "@marksman/contracts";
import { aes_font } from "@/lib/fonts";
import ModIcon from "../ModIcon";

function ModRequirementIcons({ bounty }: { bounty: ExtendedBounty }) {
  const rule = bounty.goal.modRequirement.rule;
  if (rule === "any") return <ModIcon mod="ANY" size="md" />;
  const mods = bounty.goal.modRequirement.mods;

  if (rule === "exact" && mods.length === 0)
    return <ModIcon mod={"NM"} size="md" />;

  return mods.map((mod) => {
    if (rule === "excludes") {
      return <ModIcon mod={mod} crossed key={mod} size="md" />;
    }
    return <ModIcon mod={mod} key={mod} size="md" />;
  });
}

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
          <p>
            Used mods must be <span className="text-accent">exactly</span>
          </p>
          <div className="flex gap-1">
            <ModRequirementIcons bounty={bounty} />
          </div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "includes" ? (
        <div className="flex flex-col items-center gap-2">
          <p>
            Mods must <span className="text-accent">include</span> the
            following:
          </p>
          <div className="flex gap-1">
            <ModRequirementIcons bounty={bounty} />
          </div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "excludes" ? (
        <div className="flex flex-col items-center gap-2">
          <p>
            Some mods must be <span className="text-accent">excluded</span> to
            qualify
          </p>
          <div className="flex gap-1">
            <ModRequirementIcons bounty={bounty} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
