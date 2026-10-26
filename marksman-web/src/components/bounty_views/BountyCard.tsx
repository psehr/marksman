"use client";

import ModIcon from "../ModIcon";
import { ExtendedBounty, getBountyTier } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import BPIcon from "../BPIcon";
import BountyTierBadge from "../BountyTierBadge";
import GradeIcon from "../GradeIcon";
import { BeatmapCard } from "./BeatmapCard";

export function BadgeLabel({
  label,
  text,
}: {
  label: string;
  text: React.ReactNode;
}) {
  return (
    <span
      title={label}
      className={`border-border bg-surface relative inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-xs border px-2 text-xs leading-none font-bold tracking-wide`}
    >
      {text}
    </span>
  );
}

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

export default function BountyCard({ bounty }: { bounty: ExtendedBounty }) {
  let mod_requirement;
  let acc_requirement;
  let mods;
  let goalType;
  let status;

  switch (bounty.goal.modRequirement.rule) {
    case "any":
      mod_requirement = (
        <BadgeLabel label="Any mods can be used." text={`Any mods`} />
      );
      break;
    case "exact":
      mod_requirement = (
        <BadgeLabel label="Exact mods must be used." text={`Exact mods`} />
      );
      if (bounty.goal.modRequirement.mods.length === 0) {
        mods = <ModIcon mod="NM" size="xs" key="NM" />;
      } else {
        mods = bounty.goal.modRequirement.mods.map((mod) => (
          <ModIcon mod={mod} size="xs" key={mod} />
        ));
      }
      break;
    case "excludes":
      mod_requirement = (
        <BadgeLabel
          label="Some mods must be excluded."
          text={`Excluded mods`}
        />
      );
      mods = bounty.goal.modRequirement.mods.map((mod) => (
        <ModIcon mod={mod} size="xs" key={mod} crossed />
      ));
      break;
    case "includes":
      mod_requirement = (
        <BadgeLabel
          label="Some mods must be included."
          text={`Included mods`}
        />
      );
      mods = bounty.goal.modRequirement.mods.map((mod) => (
        <ModIcon mod={mod} size="xs" key={mod} />
      ));
      break;
  }

  switch (bounty.goal.type) {
    case "full_combo":
      goalType = <BadgeLabel label="A full-combo is required." text="FC" />;
      break;

    case "minimum_grade":
      goalType = (
        <div className="flex items-center gap-1">
          <BadgeLabel
            label="X players have bookmarked this bounty."
            text="Minimum grade"
          />
          <GradeIcon
            grade={bounty.goal.minimumGradeRequirement}
            minimum
            size="sm"
          />
        </div>
      );
      break;
  }

  switch (bounty.status) {
    case "open":
      status = (
        <p className="text-foreground-muted text-xs">
          Created by {bounty.owner?.username ?? "owner"}{" "}
          {formatDistance(new Date(), bounty.createdAt)} ago
        </p>
      );
      break;
    case "completed":
      if (bounty.winner && bounty.completedAt) {
        status = (
          <p className="text-foreground-muted text-xs">
            Completed by {bounty.winner.username}{" "}
            {formatDistance(new Date(), bounty.completedAt)} ago
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
            Cancelled {formatDistance(new Date(), bounty.cancelledAt)} ago
          </p>
        );
      }
      break;
  }

  if (bounty.goal.minimumAccuracy !== undefined) {
    acc_requirement = (
      <BadgeLabel
        label={`A minimum accuracy of ${bounty.goal.minimumAccuracy}% is required.`}
        text={`Acc. ≥${bounty.goal.minimumAccuracy}%`}
      />
    );
  }

  const tier = getBountyTier(bounty.rewardBp);

  return (
    <Link
      className="bg-card border-border hover:border-focus-ring focus-visible:border-accent flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded border transition-all focus-visible:outline-0"
      href={`/bounties/${bounty.id}`}
    >
      <BeatmapCard beatmapMetadata={bounty.beatmap} variant="bounty" />
      <div className="flex place-content-between gap-4 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {status ?? null}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {goalType ?? null}
            {goalType ? <span className="text-border">•</span> : null}
            {acc_requirement ?? null}
            {acc_requirement ? <span className="text-border">•</span> : null}
            {mod_requirement ?? null}
            <div className="flex flex-wrap gap-1">{mods ?? null}</div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1">
            <span className="text-accent text-2xl font-bold leading-none -translate-y-px">
              {bounty.rewardBp.toLocaleString()}
            </span>
            <BPIcon size="md" />
          </div>
          <BountyTierBadge tier={tier} size="md" />
        </div>
      </div>
    </Link>
  );
}
