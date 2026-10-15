"use client";

import {
  BountyCompletionValidity,
  BountyScoreCandidate,
  ExtendedBounty,
  ScoreResponse,
} from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import { useEffect, useState } from "react";
import ClaimBountyButton from "./buttons/ClaimBounty";
import Image from "next/image";

function validityCheck(validity: BountyCompletionValidity): boolean {
  return Object.values(validity).every(
    (value) => value === undefined || value === true,
  );
}

function promptScoreId(setSelectedScoreId: (id: number) => void) {
  let promptedScoreId;
  const scoreUrl = window.prompt("Enter your osu! score URL:");

  if (scoreUrl === null || scoreUrl.trim() === "") return;

  const scoreRegex = /^(?:https:\/\/osu\.ppy\.sh\/scores\/)?(\d+)\/?$/;

  const match = scoreUrl.trim().match(scoreRegex);
  promptedScoreId = match ? Number(match[1]) : null;

  if (
    promptedScoreId === null ||
    !Number.isSafeInteger(promptedScoreId) ||
    promptedScoreId <= 0
  ) {
    return window.alert("Invalid URL/ID input");
  }

  setSelectedScoreId(promptedScoreId);
}

function InlineScore({
  score,
  onClickAction,
  selected,
}: {
  score: ScoreResponse | number;
  onClickAction?: () => void;
  selected?: boolean;
}) {
  if (typeof score === "number") {
    return (
      <Link href={`https://osu.ppy.sh/scores/${score}`}>Score #{score} ↗</Link>
    );
  }

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded border border-slate-600 w-full ${selected ? "bg-green-400/30" : "bg-black/30"} ${onClickAction ? "cursor-pointer" : ""}`}
      onClick={onClickAction}
    >
      {score.beatmapset?.covers.cover ? (
        <Image
          className="absolute z-0 w-full"
          src={score.beatmapset?.covers.cover}
          width={900}
          height={250}
          alt="background cover"
        />
      ) : null}
      <div className="absolute z-0 size-full bg-black/70"></div>
      <div className="z-10 px-4 p-2">
        <div className="flex place-content-between">
          <p>
            {score.rank} • {(score.accuracy * 100).toFixed(2)}% •{" "}
            {score.mods.map((mod) => mod.acronym)}
          </p>
          <p>
            Set {formatDistance(Date.now(), Date.parse(score.ended_at))} ago
          </p>
        </div>
        <div className="flex place-content-between">
          <p>
            {score.statistics.miss ?? 0}✗ • {score.max_combo}/
            {score.beatmap.max_combo}
          </p>
          <Link
            href={`https://osu.ppy.sh/scores/${score.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            View score ↗
          </Link>
        </div>
      </div>
    </div>
  );
}

function displayScorePicker(
  scores: BountyScoreCandidate[],
  selectedScoreId: number | null,
  setSelectedScoreId: (scoreId: number | null) => void,
) {
  return scores.map((score) => {
    return (
      <div className="flex gap-2" key={score.id}>
        <input
          type="radio"
          name="claim-score"
          value={score.id}
          aria-label={`Select score ${score.id}: ${score.rank}, ${(score.accuracy * 100).toFixed(2)}% accuracy`}
          checked={selectedScoreId === score.id}
          onChange={() => setSelectedScoreId(score.id)}
        />
        <InlineScore
          score={score}
          onClickAction={() => setSelectedScoreId(score.id)}
          selected={selectedScoreId === score.id}
        />
      </div>
    );
  });
}

const failureMessages: Record<keyof BountyCompletionValidity, string> = {
  bountyIsClaimable: "Bounty is currently not open to claims.",
  playerIsClaimant: "The player is not the authenticated user.",
  playerIsNotOwner: "The player is the bounty owner.",
  beatmapIsCorrect: "Beatmap doesn't match bounty requirements.",
  rulesetIsCorrect: "Ruleset is not osu! standard.",
  scoreIsSetAfterCreation: "Score was set before bounty creation.",
  scoreIsPassed: "Score is not a pass.",
  modsAreCorrect: "Mods don't match bounty requirements.",
  scoreAccuracyIsSatisfied:
    "Score's accuracy doesn't match bounty requirements.",
  gradeIsSatisfied: "Score's grade is below bounty requirements.",
  fcIsSatisfied: "Score doesn't meet bounty FC requirements.",
};

const validMessage = "Selected score meets the checked requirements.";
const noteOnEligibilityMessage =
  "Eligibility will be checked again when you claim.";

function UnmetBountyRequirements({
  validity,
}: {
  validity: BountyCompletionValidity;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {Object.entries(validity).map(([key, value]) => {
        if (value !== false) return null;

        const field = key as keyof BountyCompletionValidity;

        return (
          <li
            key={field}
            className="flex items-start gap-2 rounded border border-amber-400/30
          bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{failureMessages[field]}</span>
          </li>
        );
      })}
      {validityCheck(validity) ? (
        <>
          <li className="flex items-start gap-2 px-4 py-2 rounded border border-green-400/30 bg-green-400/10 text-sm text-green-200">
            <span aria-hidden="true">✅</span>
            <span>{validMessage}</span>
          </li>
          <li className="flex items-start gap-2 px-4 py-2 rounded border border-blue-400/30 bg-blue-400/10 text-sm text-blue-200">
            <span aria-hidden="true">ℹ️</span>
            <span>{noteOnEligibilityMessage}</span>
          </li>
        </>
      ) : null}
    </ul>
  );
}

export default function ClaimWizard({
  bounty,
  selectedScoreId,
  setSelectedScoreId,
  refresh,
}: {
  bounty: ExtendedBounty;
  selectedScoreId: number | null;
  setSelectedScoreId: (scoreId: number | null) => void;
  refresh: () => void;
}) {
  const [recentScoresLookupStatus, setRecentScoresLookupStatus] = useState<
    "loading" | "errored" | "complete"
  >("loading");

  const [scoreCandidates, setScoreCandidates] = useState<
    BountyScoreCandidate[]
  >([]);

  const [refreshRecentScores, setRefreshRecentScores] = useState(0);

  const [manualCandidate, setManualCandidate] =
    useState<BountyScoreCandidate | null>(null);

  const [manualLookupStatus, setManualLookupStatus] = useState<
    "idle" | "loading" | "complete" | "errored"
  >("idle");

  const [manualLookupError, setManualLookupError] = useState<string | null>(
    null,
  );
  const [manualLookupAttempt, setManualLookupAttempt] = useState(0);
  const recentCandidate = scoreCandidates.find(
    (score) => score.id === selectedScoreId,
  );
  const hasRecentCandidate = recentCandidate !== undefined;

  useEffect(() => {
    let ignore = false;

    async function loadRecentScores() {
      try {
        setRecentScoresLookupStatus("loading");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bounties/${bounty.id}/recent-scores`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (response.ok) {
          const scores = await response.json();

          if (!ignore) {
            setScoreCandidates(scores);
            setRecentScoresLookupStatus("complete");
          }
        } else {
          throw new Error("Failed to load recent scores");
        }
      } catch (error) {
        if (!ignore) {
          setRecentScoresLookupStatus("errored");
        }
      }
    }

    void loadRecentScores();

    return () => {
      ignore = true;
    };
  }, [refreshRecentScores, bounty.id]);

  useEffect(() => {
    setManualCandidate(null);
    setManualLookupError(null);

    if (selectedScoreId === null || hasRecentCandidate) {
      setManualLookupStatus("idle");
      return;
    }

    let ignore = false;

    async function loadManualCandidate() {
      try {
        setManualLookupStatus("loading");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bounties/${bounty.id}/scores/${selectedScoreId}/preview`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (response.ok) {
          const score = await response.json();

          if (!ignore) {
            setManualCandidate(score);
            setManualLookupStatus("complete");
          }
        } else {
          const data = await response.json().catch(() => null);
          throw new Error(
            typeof data?.error === "string" && data.error.trim()
              ? data.error
              : `Could not look up this score (${response.status}). Please try again.`,
          );
        }
      } catch (error) {
        if (!ignore) {
          setManualLookupStatus("errored");
          setManualLookupError(
            error instanceof Error
              ? error.message
              : "Could not look up this score. Please try again.",
          );
        }
      }
    }

    void loadManualCandidate();

    return () => {
      ignore = true;
    };
  }, [selectedScoreId, bounty.id, hasRecentCandidate, manualLookupAttempt]);

  const selectedCandidate =
    recentCandidate ??
    (manualCandidate?.id === selectedScoreId ? manualCandidate : undefined);

  return (
    <div className="w-full grid grid-cols-2 gap-6">
      <div className="flex flex-col items-center gap-4 border border-dotted rounded p-4">
        <div className="w-full flex flex-col items-center px-4 gap-4">
          <p className="text-lg">Currently selected score</p>
          {selectedScoreId ? (
            <InlineScore score={selectedCandidate ?? selectedScoreId} />
          ) : (
            <p>[No selected score]</p>
          )}
        </div>
        {selectedScoreId ? (
          <ClaimBountyButton
            bounty={bounty}
            refresh={refresh}
            scoreId={selectedScoreId ?? undefined}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-4 border border-dotted rounded p-4">
        <h1 className="text-lg">Score evaluation</h1>
        {selectedCandidate ? (
          <UnmetBountyRequirements validity={selectedCandidate.validity} />
        ) : selectedScoreId === null ? (
          <p>[No selected score]</p>
        ) : manualLookupStatus === "errored" ? (
          <>
            <p role="alert">{manualLookupError}</p>
            <button
              type="button"
              className="cursor-pointer rounded border px-3 py-1"
              onClick={() => setManualLookupAttempt((previous) => previous + 1)}
            >
              Retry score lookup
            </button>
          </>
        ) : (
          <p role="status">Looking up selected score...</p>
        )}
      </div>

      <div className="col-span-2 flex flex-col gap-8 border border-dotted p-4 rounded">
        <div className="flex items-center justify-between gap-2">
          <p id="recent-scores-heading">Select a score candidate:</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="cursor-pointer rounded border px-3 py-1 disabled:cursor-wait disabled:opacity-50"
              disabled={recentScoresLookupStatus === "loading"}
              onClick={() => setRefreshRecentScores((previous) => previous + 1)}
            >
              {recentScoresLookupStatus === "errored"
                ? "Retry"
                : "Refresh recent scores"}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded border px-3 py-1"
              onClick={() => promptScoreId(setSelectedScoreId)}
            >
              Select manually
            </button>
          </div>
        </div>
        {recentScoresLookupStatus === "loading" ? (
          <div className="w-full h-16 place-content-center items-center">
            <p>Loading...</p>
          </div>
        ) : null}
        {recentScoresLookupStatus === "complete" ? (
          <div
            role="radiogroup"
            aria-labelledby="recent-scores-heading"
            className="flex flex-col gap-2"
          >
            {scoreCandidates.length === 0 ? (
              <p>
                No matching recent scores found. Refresh after playing, or
                select a score manually.
              </p>
            ) : (
              displayScorePicker(
                scoreCandidates,
                selectedScoreId,
                setSelectedScoreId,
              )
            )}
          </div>
        ) : null}
        {recentScoresLookupStatus === "errored" ? (
          <p role="alert">
            Could not fetch scores. Retry or select a score manually.
          </p>
        ) : null}
      </div>
    </div>
  );
}
