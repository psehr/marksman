"use client";

import { aes_font } from "@/lib/fonts";
import Image from "next/image";
import ModIcon from "../ModIcon";
import {
  BountyBeatmapMetadata,
  ExtendedBounty,
  getBountyTier,
} from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import BPIcon from "../BPIcon";
import BountyTierBadge from "../BountyTierBadge";

function BadgeLabel({ label, text }: { label: string; text: string }) {
  return (
    <span
      title={label}
      className={`border-border bg-surface relative inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-xs border px-2 text-xs leading-none font-bold tracking-wide`}
    >
      {text}
    </span>
  );
}

function BeatmapCard({
  beatmapMetadata,
}: {
  beatmapMetadata: BountyBeatmapMetadata | null;
}) {
  const coverUrl = beatmapMetadata?.covers?.cover;
  const title = `${beatmapMetadata?.song?.title ?? "title"}`;
  const artist = `${beatmapMetadata?.song?.artist ?? "artist"}`;
  const version = `${beatmapMetadata?.version.name ?? "version"}`;
  const mapper = `${beatmapMetadata?.creator?.username ?? "mapper"}`;

  return (
    <div className="relative h-24 overflow-hidden">
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt="Beatmap Cover"
          fill
          className="object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-black/50" aria-hidden></div>
      <div
        className="to-card absolute inset-0 bg-linear-to-b from-transparent"
        aria-hidden="true"
      />
      <div
        className={`relative z-10 gap-4 ${aes_font.className} flex size-full p-2 px-4`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-accent truncate text-lg font-bold">{title}</p>
          <p className="text-foreground-muted truncate text-sm italic">
            {artist}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col text-end">
          <p className="text-accent truncate text-lg font-bold">
            [ {version} ]
          </p>
          <p className="text-foreground-muted truncate text-sm italic">
            {mapper}
          </p>
        </div>
      </div>
    </div>
  );
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
        mods = <ModIcon mod="NM" size="sm" key="NM" />;
      } else {
        mods = bounty.goal.modRequirement.mods.map((mod) => (
          <ModIcon mod={mod} size="sm" key={mod} />
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
        <ModIcon mod={mod} size="sm" key={mod} crossed />
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
        <ModIcon mod={mod} size="sm" key={mod} />
      ));
      break;
  }

  switch (bounty.goal.type) {
    case "full_combo":
      goalType = <BadgeLabel label="A full-combo is required." text="FC" />;
      break;

    case "minimum_grade":
      goalType = (
        <BadgeLabel
          label={`A minimum grade of ${bounty.goal.minimumGradeRequirement} is required.`}
          text={`Grade >=${bounty.goal.minimumGradeRequirement}`}
        />
      );
      break;
  }

  switch (bounty.status) {
    case "open":
      status = (
        <p className="text-foreground-muted text-xs italic">
          Created by {bounty.owner?.username ?? "owner"}{" "}
          {formatDistance(new Date(), bounty.createdAt)} ago
        </p>
      );
      break;
    case "completed":
      if (bounty.winner && bounty.completedAt) {
        status = (
          <p className="text-foreground-muted text-xs italic">
            Completed by {bounty.winner.username}{" "}
            {formatDistance(new Date(), bounty.completedAt)} ago
          </p>
        );
      } else {
        status = (
          <p className="text-foreground-muted text-xs italic">Completed</p>
        );
      }
      break;
    case "cancelled":
      if (bounty.cancelledAt) {
        status = (
          <p className="text-foreground-muted text-xs italic">
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
        text={`Accuracy >=${bounty.goal.minimumAccuracy}%`}
      />
    );
  }

  const tier = getBountyTier(bounty.rewardBp);

  return (
    <Link
      className="bg-card border-border hover:border-focus-ring focus-visible:border-accent flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded border transition-all focus-visible:outline-0"
      href={`/bounties/${bounty.id}`}
    >
      <BeatmapCard beatmapMetadata={bounty.beatmap} />
      <div className="flex place-content-between gap-4 p-2 px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {goalType ?? null}
            {acc_requirement ?? null}
            {mod_requirement ?? null}
            <div className="flex flex-wrap gap-1">{mods ?? null}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {status ?? null}
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
