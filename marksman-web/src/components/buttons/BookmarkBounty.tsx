import { ExtendedBounty } from "@marksman/contracts";
import { useAuth } from "../AuthProvider";
import { useState } from "react";

async function handleBookmark(bountyId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/bounties/${bountyId}/bookmark`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      window.alert(`Bookmark failed (${response.status})`);
      return;
    }

    window.alert("Successfully bookmarked bounty");
    return true;
  } catch (error) {
    console.error("Bookmark request failed:", error);
    window.alert(
      "Could not bookmark the bounty. See the browser console for details.",
    );
  }
}

async function handleUnbookmark(bountyId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/bounties/${bountyId}/unbookmark`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      window.alert(`Unbookmark failed (${response.status})`);
      return;
    }

    window.alert("Successfully unbookmarked bounty");
    return true;
  } catch (error) {
    console.error("Unbookmark request failed:", error);
    window.alert(
      "Could not unbookmark the bounty. See the browser console for details.",
    );
  }
}

export default function BookmarkBountyButton({
  bounty,
  refresh,
}: {
  bounty: ExtendedBounty;
  refresh: () => void;
}) {
  const { user, refreshUser } = useAuth();
  const isOwner = bounty.creatorOsuUserId === user?.identity.osuUserId;
  const isOpen = bounty.status === "open";

  const isBookmarked = bounty.engagement.isBookmarkedByCurrentUser;

  const [disabled, setDisabled] = useState(false);

  if (!isBookmarked) {
    return !isOwner && user && isOpen ? (
      <button
        className="bg-yellow-500 rounded-md cursor-pointer w-fit px-4 py-2"
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            setDisabled(true);
            handleBookmark(bounty.id)
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
        Bookmark
      </button>
    ) : null;
  } else {
    return !isOwner && user ? (
      <button
        className="bg-red-500 rounded-md cursor-pointer w-fit px-4 py-2"
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) {
            setDisabled(true);
            handleUnbookmark(bounty.id)
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
        Unbookmark
      </button>
    ) : null;
  }
}
