import { aes_font, base_font } from "@/lib/fonts";
import { ExtendedBounty } from "@marksman/contracts";
import GradeIcon from "@/components/osu/GradeIcon";
import Link from "next/link";

export default function GoalCategory({ bounty }: { bounty: ExtendedBounty }) {
  const BMAP_MAX_COMBO = bounty.beatmap?.specs.maxCombo;
  const MIN_REQUIRED_FC_COMBO =
    bounty.goal.type === "full_combo" && BMAP_MAX_COMBO
      ? Math.ceil(BMAP_MAX_COMBO * (bounty.goal.minimumComboRatio ?? 0.99))
      : null;

  return (
    <div className={`flex flex-col gap-2 ${aes_font.className} font-bold`}>
      {bounty.goal.type === "full_combo" ? (
        <>
          <p>
            A <span className="text-accent">full-combo</span> is required
          </p>
          <div className={`${base_font.className} font-normal`}>
            <p className="text-sm text-foreground-muted font-bold">
              osu!stable requirements:
            </p>
            <p className="text-xs text-foreground-muted">
              Stable-Combo-Threshold:{" "}
              {(bounty.goal.minimumComboRatio ?? 0.99) * 100}%
            </p>
            {BMAP_MAX_COMBO && MIN_REQUIRED_FC_COMBO ? (
              <p className="text-xs text-foreground-muted">
                Minimum required combo: {MIN_REQUIRED_FC_COMBO}/{BMAP_MAX_COMBO}
              </p>
            ) : null}
          </div>
          <Link
            href="/about/bounties#fc-ruling"
            className="text-sm text-foreground-muted underline"
          >
            Learn more
          </Link>
        </>
      ) : null}
      {bounty.goal.type === "pass" ? (
        <div className="flex flex-col items-center">
          <p>
            <span className="text-accent">Clear/Pass</span> the map without
            using No-Fail.
          </p>
        </div>
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
