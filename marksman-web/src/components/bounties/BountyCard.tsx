"use client";

import ModIcon from "../osu/ModIcon";
import {
  ExtendedBounty,
  getBountyTier,
  bountyModFilterSchema,
  modsSchema,
  type BountyTier,
} from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import BPIcon from "../economy/BPIcon";
import GradeIcon from "../osu/GradeIcon";
import { BeatmapCard } from "../beatmaps/BeatmapCard";
import { BadgeLabel } from "../ui/BadgeLabel";
import BountyHuntStamps from "./BountyHuntStamps";

const tierColors = {
  Easy: "#a3cf83",
  Normal: "#83bfcf",
  Hard: "#efa85c",
  Lunatic: "#ed8d83",
  Extra: "#c4a3ed",
  Phantasm: "#c4a3ed",
} satisfies Record<BountyTier, string>;

const phantasmColors = [
  "#ed8d83",
  "#efa85c",
  "#e6c65b",
  "#a3cf83",
  "#83bfcf",
  "#c4a3ed",
];
const phantasmGradient = `linear-gradient(110deg, ${phantasmColors.join(", ")})`;

export function bountyCardBorderStyle(
  rewardBp: number | null,
): React.CSSProperties {
  if (!rewardBp) return {};
  const tier = getBountyTier(rewardBp);
  if (tier === "Phantasm") {
    return {
      "--bounty-tier-border": "transparent",
      background: `linear-gradient(var(--color-card), var(--color-card)) padding-box, linear-gradient(110deg, ${phantasmColors.map((color) => `${color}a6`).join(", ")}) border-box`,
    } as React.CSSProperties;
  }
  const color = tierColors[tier];
  return {
    "--bounty-tier-border": `color-mix(in srgb, ${color} 65%, transparent)`,
  } as React.CSSProperties;
}

export type BountyCardDisplay = {
  beatmap: ExtendedBounty["beatmap"];
  goal: ExtendedBounty["goal"] | null;
  rewardBp: number | null;
};

export default function BountyCard({ bounty }: { bounty: ExtendedBounty }) {
  const content: BountyCardDisplay = {
    beatmap: bounty.beatmap,
    goal: bounty.goal,
    rewardBp: bounty.rewardBp,
  };

  let status;

  switch (bounty.status) {
    case "open":
      status = (
        <p className="text-foreground-muted text-xs">
          Created by {bounty.owner?.username ?? "owner"}{" "}
          {formatDistance(bounty.createdAt, new Date(), {
            addSuffix: true,
          })}
        </p>
      );
      break;
    case "completed":
      if (bounty.winner && bounty.completedAt) {
        status = (
          <p className="text-foreground-muted text-xs">
            Completed by {bounty.winner.username}{" "}
            {formatDistance(bounty.completedAt, new Date(), {
              addSuffix: true,
            })}
          </p>
        );
      } else {
        status = <p className="text-foreground-muted text-xs">Completed</p>;
      }
      break;
    case "cancelled":
      if (bounty.cancelledAt) {
        status = (
          <p className="text-foreground-muted text-xs">
            Cancelled{" "}
            {formatDistance(bounty.cancelledAt, new Date(), {
              addSuffix: true,
            })}
          </p>
        );
      }
      break;
  }

  return (
    <Link
      className="relative isolate bg-card border-[var(--bounty-tier-border,var(--color-border))] hover:border-focus-ring focus-visible:border-accent flex w-full min-w-0 cursor-pointer flex-col justify-between overflow-hidden rounded border transition-all focus-visible:outline-0"
      style={bountyCardBorderStyle(bounty.rewardBp)}
      href={`/bounties/${bounty.id}`}
    >
      <BountyCardContent
        content={content}
        status={status}
        hunterCount={bounty.engagement.hunterCount}
        completed={bounty.status === "completed"}
        cancelled={bounty.status === "cancelled"}
      />
    </Link>
  );
}

export function BountyCardContent({
  content,
  status,
  hunterCount = 0,
  completed = false,
  cancelled = false,
}: {
  content: BountyCardDisplay;
  status?: React.ReactNode;
  hunterCount?: number;
  completed?: boolean;
  cancelled?: boolean;
}) {
  let acc_requirement;
  let gradeRequirement;
  let mods;
  let goalType;

  const tier = content.rewardBp ? getBountyTier(content.rewardBp) : null;
  const modSettings = content.goal?.modRequirement;

  if (modSettings) {
    const hasPossibleExtraMod =
      modSettings.allowOtherMods &&
      bountyModFilterSchema.options.some(
        (mod) =>
          mod !== "NM" &&
          !modSettings.required.includes(mod) &&
          !modSettings.forbidden.includes(mod) &&
          !(content.goal?.type === "pass" && mod === "NF") &&
          modsSchema.safeParse([...modSettings.required, mod]).success,
      );
    const unrestricted =
      modSettings.allowOtherMods &&
      modSettings.required.length === 0 &&
      modSettings.forbidden.length === 0;

    const description = unrestricted
      ? "Any supported mod combination can be used."
      : !modSettings.allowOtherMods
        ? modSettings.required.length === 0
          ? "No mods allowed."
          : `Exactly ${modSettings.required.join(" + ")} required; no other mods allowed.`
        : [
            modSettings.required.length
              ? `Required: ${modSettings.required.join(", ")}.`
              : "No required mods.",
            modSettings.forbidden.length
              ? `Forbidden: ${modSettings.forbidden.join(", ")}.`
              : "",
            hasPossibleExtraMod
              ? "Other supported mods allowed."
              : "No additional supported mods can be used.",
          ]
            .filter(Boolean)
            .join(" ");

    mods = unrestricted ? null : (
      <span role="img" aria-label={description} title={description}>
        <span aria-hidden="true" className="flex flex-wrap items-center gap-1">
          {!modSettings.allowOtherMods && modSettings.required.length === 0 ? (
            <ModIcon mod="NM" size="sm" />
          ) : (
            <>
              {modSettings.required.map((mod) => (
                <ModIcon mod={mod} size="sm" key={mod} />
              ))}
              {modSettings.forbidden.map((mod) => (
                <ModIcon mod={mod} size="sm" key={mod} crossed />
              ))}
              {hasPossibleExtraMod && (
                <span
                  title="Other supported mods allowed"
                  className="inline-flex h-5 items-center justify-center px-1 text-xs font-bold text-foreground-muted"
                >
                  + Any mods
                </span>
              )}
            </>
          )}
        </span>
      </span>
    );
  }

  switch (content.goal?.type) {
    case "full_combo":
      goalType = (
        <BadgeLabel
          label="A full-combo is required."
          text="Full-Combo"
          color="accent"
        />
      );
      break;

    case "pass":
      goalType = (
        <BadgeLabel
          label={`Clear/Pass the map without using No-Fail`}
          text="Clear/Pass"
          color="danger"
        />
      );
      break;
  }

  if (content.goal?.minimumGrade !== undefined) {
    gradeRequirement = (
      <div className="flex items-center gap-1">
        <GradeIcon grade={content.goal.minimumGrade} minimum size="md" />
      </div>
    );
  }

  if (content.goal?.minimumAccuracy !== undefined) {
    acc_requirement = (
      <BadgeLabel
        label={`A minimum accuracy of ${content.goal.minimumAccuracy}% is required.`}
        color="info"
        text={`Acc. ≥${content.goal.minimumAccuracy}%`}
      />
    );
  }

  return (
    <>
      {content.beatmap?.covers?.cover && (
        <>
          <Image
            src={
              content.beatmap.covers["cover@2x"] ?? content.beatmap.covers.cover
            }
            alt=""
            fill
            className="pointer-events-none object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/90 via-black/45 to-black/90"
            aria-hidden="true"
          />
        </>
      )}
      {tier && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] forced-colors:hidden"
          style={
            tier === "Phantasm"
              ? {
                  background: phantasmGradient,
                  opacity: 0.2,
                  maskImage: [
                    "linear-gradient(to right, black, transparent 40px, transparent calc(100% - 40px), black)",
                    "linear-gradient(to bottom, black, transparent 40px, transparent calc(100% - 40px), black)",
                  ].join(", "),
                }
              : {
                  boxShadow: `inset 0 0 100px 2px color-mix(in srgb, ${tierColors[tier]} 20%, transparent)`,
                }
          }
        />
      )}
      <BeatmapCard beatmapMetadata={content.beatmap} variant="bounty" />
      {hunterCount > 0 && (
        <div className="relative z-10 flex justify-end px-4">
          <BountyHuntStamps count={hunterCount} />
        </div>
      )}
      <div className="relative z-10 flex place-content-between items-end gap-4 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {status ?? null}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {completed ? (
              <BadgeLabel
                label={"Completed"}
                text={"Completed"}
                color="success"
              />
            ) : null}
            {cancelled ? (
              <BadgeLabel
                label={"Cancelled"}
                text={"Cancelled"}
                color="danger"
              />
            ) : null}
            {goalType ?? null}

            {acc_requirement ?? null}

            {gradeRequirement ?? null}

            {mods ? <div className="flex flex-wrap gap-1">{mods}</div> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div
            className="flex gap-1"
            title={tier ? `Reward tier: ${tier}` : undefined}
          >
            {tier && <span className="sr-only">Reward tier: {tier}. </span>}
            <span className="text-accent text-2xl font-bold leading-none -translate-y-px">
              {content.rewardBp ? content.rewardBp.toLocaleString() : "-"}
            </span>
            <BPIcon size="md" />
          </div>
        </div>
      </div>
    </>
  );
}
