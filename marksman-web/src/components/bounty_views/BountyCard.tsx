"use client";

import { aes_font } from "@/lib/fonts";
import Image from "next/image";
import ModIcon from "../ModIcon";
import { BountyBeatmapMetadata, ExtendedBounty } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import { useRouter } from "next/navigation";

function BadgeLabel({ label, text }: { label: string; text: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xs border border-border bg-surface font-bold leading-none tracking-wide h-6 min-w-8 px-2 text-xs`}
    >
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

function BeatmapCard({
  beatmapMetadata,
}: {
  beatmapMetadata: BountyBeatmapMetadata | null;
}) {
  const coverUrl = `${beatmapMetadata?.covers?.cover ?? null}`;
  const title = `${beatmapMetadata?.song?.title ?? "title"}`;
  const artist = `${beatmapMetadata?.song?.artist ?? "artist"}`;
  const version = `${beatmapMetadata?.version.name ?? "version"}`;
  const mapper = `${beatmapMetadata?.creator?.username ?? "mapper"}`;

  return (
    <div className="relative h-20 overflow-hidden">
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
        className="absolute inset-0 bg-linear-to-b from-transparent to-card"
        aria-hidden="true"
      />
      <div
        className={`relative z-10 gap-4 ${aes_font.className} flex size-full px-4 p-2`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-accent truncate text-lg font-bold">{title}</p>
          <p className="text-foreground-muted text-sm italic truncate">
            {artist}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col text-end">
          <p className="text-accent text-lg truncate font-bold">
            [ {version} ]
          </p>
          <p className="text-foreground-muted text-sm italic truncate">
            {mapper}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BountyCard({ bounty }: { bounty: ExtendedBounty }) {
  const router = useRouter();

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
        <p className="text-xs text-foreground-muted italic">
          Created by {bounty.owner?.username ?? "owner"}{" "}
          {formatDistance(new Date(), bounty.createdAt)} ago
        </p>
      );
      break;
    case "completed":
      if (bounty.winner && bounty.completedAt) {
        status = (
          <p className="text-xs text-foreground-muted italic">
            Completed by {bounty.winner.username}{" "}
            {formatDistance(new Date(), bounty.completedAt)} ago
          </p>
        );
      } else {
        status = (
          <p className="text-xs text-foreground-muted italic">Completed</p>
        );
      }
      break;
    case "cancelled":
      if (bounty.cancelledAt) {
        status = (
          <p className="text-xs text-foreground-muted italic">
            Cancelled {formatDistance(new Date(), bounty.cancelledAt)} ago
          </p>
        );
      }
      break;
  }

  if (bounty.goal.minimumAccuracy !== undefined) {
    acc_requirement = (
      <BadgeLabel
        label="A minimum accuracy is required."
        text={`Accuracy >=${bounty.goal.minimumAccuracy}%`}
      />
    );
  }

  return (
    <div
      className="bg-card flex w-full min-w-0 flex-col overflow-hidden rounded border border-border hover:brightness-110 cursor-pointer"
      onClick={() => {
        router.push("/bounties/" + bounty.id);
      }}
    >
      <BeatmapCard beatmapMetadata={bounty.beatmap} />
      <div className="flex place-content-between px-4 p-2 gap-4">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="flex gap-2 flex-wrap">
            {goalType ?? null}
            {acc_requirement ?? null}
            {mod_requirement ?? null}
            <div className="flex flex-wrap gap-1">{mods ?? null}</div>
          </div>
          <div className="flex gap-1 items-center flex-wrap">
            {status ?? null}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-end shrink-0 whitespace-nowrap">
          <p className="text-xl font-bold text-accent">{bounty.rewardBp} BP</p>
          <p className="text-xs text-foreground-muted italic"></p>
        </div>
      </div>
    </div>
  );
}
