"use client";

import ModIcon from "../ModIcon";
import { ExtendedBounty, getBountyTier } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import BPIcon from "../BPIcon";
import BountyTierBadge from "../BountyTierBadge";
import GradeIcon from "../GradeIcon";
import { BeatmapCard } from "./BeatmapCard";
import { BadgeLabel } from "./BadgeLabel";

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
            label={`Achieve a minimum grade of ${bounty.goal.minimumGradeRequirement}`}
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
  const coverUrl = bounty.beatmap?.covers?.cover;

  return (
    <Link
      className="relative isolate bg-card border-border hover:border-focus-ring focus-visible:border-accent flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded border transition-all focus-visible:outline-0"
      href={`/bounties/${bounty.id}`}
    >
      {coverUrl && (
        <>
          <Image
            src={coverUrl}
            alt=""
            fill
            className="pointer-events-none object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/90 via-black/40 to-black/90"
            aria-hidden="true"
          />
        </>
      )}
      <BeatmapCard beatmapMetadata={bounty.beatmap} variant="bounty" />
      <div className="relative z-10 flex place-content-between items-end gap-4 p-4">
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
          <BountyTierBadge tier={tier} size="md" />
          <div className="flex gap-1">
            <span className="text-accent text-2xl font-bold leading-none -translate-y-px">
              {bounty.rewardBp.toLocaleString()}
            </span>
            <BPIcon size="md" />
          </div>
        </div>
      </div>
    </Link>
  );
}
