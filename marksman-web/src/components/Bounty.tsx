import type { ExtendedBounty } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Image from "next/image";
import ModIcon from "./ModIcon";
import GoalIcon from "./GoalIcon";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function renderMods(bounty: ExtendedBounty, size: "sm" | "md" | "lg") {
  const rule = bounty.goal.modRequirement.rule;
  if (rule === "any") return <ModIcon mod="ANY" size={size} />;
  const mods = bounty.goal.modRequirement.mods;

  if (rule === "exact" && mods.length === 0)
    return <ModIcon mod={"NM"} size={size} />;

  return mods.map((mod) => {
    if (rule === "excludes") {
      return <ModIcon mod={mod} crossed key={mod} size={size} />;
    }
    return <ModIcon mod={mod} key={mod} size={size} />;
  });
}

export default function Bounty(props: { bounty: ExtendedBounty }) {
  const router = useRouter();
  const b = props.bounty;
  const beatmap = b.beatmap;

  const beatmapCover = beatmap?.covers?.cover;

  return (
    <div
      className="flex relative w-full h-32 overflow-clip border border-slate-600 cursor-pointer hover:brightness-110"
      onClick={() => {
        router.push("/bounties/" + b.id);
      }}
    >
      {beatmapCover ? (
        <Image
          className="absolute z-0"
          src={beatmapCover}
          width={900}
          height={250}
          alt="Beatmap background"
          loading="eager"
        />
      ) : null}
      <div className="absolute z-10 size-full bg-black/50"></div>
      <div className="z-20 size-full flex place-content-between">
        <div className="p-2 flex flex-col min-w-0 flex-1">
          <p className="truncate">
            {beatmap?.song?.artist} - {beatmap?.song?.title} [
            {beatmap?.version.name}]
          </p>
          <p>
            Created {formatDistance(Date.now(), Date.parse(b.createdAt))} ago by{" "}
            {b.owner?.username}
          </p>
          {b.status === "completed" && b.completedAt ? (
            <>
              <p>
                Completed{" "}
                {formatDistance(Date.now(), Date.parse(b.completedAt))} ago by{" "}
                {b.winner?.username ?? b.completedByOsuUserId}
              </p>
              {b.completionScoreId ? (
                <Link
                  href={`https://osu.ppy.sh/scores/${b.completionScoreId}`}
                  className="underline"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  Score link
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="p-2 flex w-1/3 h-full shrink-0  bg-blue-950 border-l border-slate-600 border-dashed">
          <div className="flex w-1/2">
            <div className="flex gap-1">{renderMods(b, "sm")}</div>
          </div>
          <div className="flex flex-col place-content-between items-end w-1/2">
            <GoalIcon goal={b.goal} size="sm" />
            {b.goal.modRequirement.rule === "any" ? <p>Any mods</p> : null}
            {b.goal.modRequirement.rule === "includes" ? (
              <p>Includes mods</p>
            ) : null}
            {b.goal.modRequirement.rule === "excludes" ? (
              <p>Excludes mods</p>
            ) : null}
            {b.goal.modRequirement.rule === "exact" ? <p>Exact mods</p> : null}
            {b.goal.minimumAccuracy !== undefined ? (
              <p>Accuracy {">=" + b.goal.minimumAccuracy}%</p>
            ) : null}
            <p>Reward: {b.rewardBp} BP</p>
          </div>
        </div>
      </div>
    </div>
  );
}
