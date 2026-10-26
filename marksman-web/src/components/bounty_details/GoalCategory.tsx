import { aes_font } from "@/lib/fonts";
import { ExtendedBounty } from "@marksman/contracts";
import GradeIcon from "../GradeIcon";

export default function GoalCategory({ bounty }: { bounty: ExtendedBounty }) {
  return (
    <div className={`flex flex-col gap-2 ${aes_font.className} font-bold`}>
      {bounty.goal.type === "full_combo" ? (
        <div className="flex place-content-center gap-2">
          <p>A</p>
          <p className={`text-accent`}>full-combo</p>
          <p>is required</p>
        </div>
      ) : null}
      {bounty.goal.type === "minimum_grade" ? (
        <div className="flex flex-col gap-2 items-center">
          <div className="flex gap-2">
            <p>Achieve a grade of</p>
          </div>
          <GradeIcon grade={bounty.goal.minimumGradeRequirement} size="lg" />
          <p>or better</p>
        </div>
      ) : null}
      {bounty.goal.minimumAccuracy !== undefined ? (
        <p>Achieve at least {bounty.goal.minimumAccuracy}% accuracy</p>
      ) : null}
    </div>
  );
}
