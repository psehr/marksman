import { aes_font } from "@/lib/fonts";
import { ExtendedBounty } from "@marksman/contracts";
import GradeIcon from "../GradeIcon";

export default function GoalCategory({ bounty }: { bounty: ExtendedBounty }) {
  return (
    <div className={`flex flex-col gap-2 ${aes_font.className} font-bold`}>
      {bounty.goal.type === "full_combo" ? (
        <p>
          A <span className="text-accent">full-combo</span> is required
        </p>
      ) : null}
      {bounty.goal.type === "minimum_grade" ? (
        <div className="flex flex-col gap-2 items-center">
          <p>
            Achieve a <span className="text-accent">minimum grade</span> of
          </p>
          <GradeIcon grade={bounty.goal.minimumGradeRequirement} size="lg" />
        </div>
      ) : null}
      {bounty.goal.minimumAccuracy !== undefined ? (
        <p>
          Achieve at least{" "}
          <span className="text-accent">{bounty.goal.minimumAccuracy}%</span>{" "}
          accuracy
        </p>
      ) : null}
    </div>
  );
}
