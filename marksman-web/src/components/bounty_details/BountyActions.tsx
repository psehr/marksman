import { ExtendedBounty } from "@marksman/contracts";
import LoginButton from "../buttons/Login";
import CancelBountyButton from "../buttons/CancelBounty";
import BookmarkBountyButton from "../buttons/BookmarkBounty";

export type AvailableActions = {
  canCancel: boolean;
  canHunt: boolean;
  canBookmark: boolean;
  canUnbookmark: boolean;
};

export default function BountyActions({
  bounty,
  refresh,
  availableActions,
  isAuthenticated,
}: {
  bounty: ExtendedBounty;
  refresh: () => void;
  availableActions: AvailableActions;
  isAuthenticated: boolean;
}) {
  const displayAvailableActions =
    availableActions.canCancel ||
    availableActions.canBookmark ||
    availableActions.canUnbookmark;

  if (!isAuthenticated) return <LoginButton />;
  if (!displayAvailableActions)
    return <p className="text-sm">There are currently no available actions</p>;

  return (
    <div className="flex gap-2">
      {availableActions.canCancel ? (
        <CancelBountyButton bounty={bounty} refresh={refresh} />
      ) : null}
      {availableActions.canBookmark || availableActions.canUnbookmark ? (
        <BookmarkBountyButton bounty={bounty} refresh={refresh} />
      ) : null}
    </div>
  );
}
