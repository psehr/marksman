import { ExtendedBounty } from "@marksman/contracts";

export default function GoalCategory({ bounty }: { bounty: ExtendedBounty }) {
  return (
    <>
      {bounty.goal.type === "full_combo" ? (
        <p>A full-combo is required</p>
      ) : null}
      {bounty.goal.type === "minimum_grade" ? (
        <p>
          A minimum grade of {bounty.goal.minimumGradeRequirement} is required
        </p>
      ) : null}
      {bounty.goal.minimumAccuracy !== undefined ? (
        <p>
          A minimum accuracy of {bounty.goal.minimumAccuracy}% must be achieved
        </p>
      ) : null}
    </>
  );
}
