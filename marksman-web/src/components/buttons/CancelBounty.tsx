"use client";

import { ExtendedBounty } from "@marksman/contracts";
import { useState } from "react";
import { useAuth } from "../AuthProvider";

async function handleCancel(bountyId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/bounties/${bountyId}/cancel`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      window.alert(data.error ?? `Cancel failed (${response.status})`);
      return;
    }

    window.alert("Successfully cancelled bounty");
    return true;
  } catch (error) {
    console.error("Cancel request failed:", error);
    window.alert(
      "Could not cancel the bounty. See the browser console for details.",
    );
  }
}

export default function CancelBountyButton({
  bounty,
  refresh,
}: {
  bounty: ExtendedBounty;
  refresh: () => void;
}) {
  const { user, refreshUser } = useAuth();
  const isOwner = bounty.creatorOsuUserId === user?.identity.osuUserId;
  const isOpen = bounty.status === "open";

  const [disabled, setDisabled] = useState(false);

  return isOwner && isOpen ? (
    <button
      className="bg-red-900 rounded-md cursor-pointer w-fit px-4 py-2"
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          setDisabled(true);
          handleCancel(bounty.id)
            .then((succeeded) => {
              if (succeeded) {
                refresh();
                void refreshUser();
              }
            })
            .finally(() => setDisabled(false));
        }
      }}
      disabled={disabled}
    >
      Cancel bounty
    </button>
  ) : null;
}
