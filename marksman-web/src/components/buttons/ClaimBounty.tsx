"use client";

import { ExtendedBounty } from "@marksman/contracts";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthProvider";

async function handleClaim(bountyId: string, inputScoreId?: number) {
  let promptedScoreId;

  if (!inputScoreId) {
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
      return { error: "Invalid URL/ID input" };
    }
  }

  const scoreId = inputScoreId ?? promptedScoreId;

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/bounties/${bountyId}/complete`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scoreId }),
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return {
        error:
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : `Claim failed (${response.status}). Please try again.`,
      };
    }

    return { succeeded: true };
  } catch (error) {
    console.error("Claim request failed:", error);
    return {
      error: "Could not complete the request. Please try again.",
    };
  }
}

export default function ClaimBountyButton({
  bounty,
  refresh,
  scoreId,
}: {
  bounty: ExtendedBounty;
  refresh: () => void;
  scoreId?: number;
}) {
  const { user, refreshUser } = useAuth();
  const isOwner = bounty.creatorOsuUserId === user?.identity.osuUserId;
  const isOpen = bounty.status === "open";

  const [disabled, setDisabled] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const selectionVersion = useRef(0);

  useEffect(() => {
    setClaimError(null);
    return () => {
      selectionVersion.current += 1;
    };
  }, [bounty.id, scoreId, user?.identity.id]);

  return !isOwner && user && isOpen ? (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="bg-green-700 rounded-md cursor-pointer px-4 py-2"
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            setClaimError(null);
            setDisabled(true);
            const submittedSelectionVersion = selectionVersion.current;
            handleClaim(bounty.id, scoreId)
              .then((result) => {
                if (result?.succeeded) {
                  refresh();
                  void refreshUser();
                } else if (
                  result?.error &&
                  submittedSelectionVersion === selectionVersion.current
                ) {
                  setClaimError(result.error);
                }
              })
              .finally(() => setDisabled(false));
          }
        }}
        disabled={disabled}
      >
        Submit claim
      </button>
      {claimError && (
        <p
          role="alert"
          className="rounded border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200"
        >
          {claimError}
        </p>
      )}
    </div>
  ) : null;
}
