import { useAuth } from "./AuthProvider";

export type BountySortingMethod = {
  type: "date" | "bpReward";
  order: "asc" | "desc";
};

export default function SearchPanel(props: {
  searchInput: string;
  bountyType: "open" | "completed";
  setBountyType: (status: "open" | "completed") => void;
  setSearchInput: (input: string) => void;
  setSelectedSortingMethod: (input: BountySortingMethod) => void;
  selectedSortingMethod: BountySortingMethod;
  relationship: "created" | "bookmarked" | null;
  setRelationship: (relationship: "created" | "bookmarked" | null) => void;
  foundBountiesCount: number;
}) {
  const { user } = useAuth();
  return (
    <div className="flex flex-col w-full h-full place-content-center gap-8">
      <div className="flex flex-col gap-2 items-center">
        <input
          type="text"
          className="flex w-full rounded-sm text-center bg-slate-950"
          placeholder="Search bounties.."
          aria-label="Search bounties"
          value={props.searchInput}
          onChange={(event) => {
            props.setSearchInput(event.currentTarget.value);
          }}
        />
        <p className="text-xs">Found {props.foundBountiesCount} bounties</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-4">
          <p>Status:</p>
          <div className="flex gap-3">
            <button
              type="button"
              aria-pressed={props.bountyType === "open"}
              onClick={() => {
                props.setBountyType("open");
              }}
              className="cursor-pointer opacity-20 aria-pressed:opacity-100"
            >
              Open
            </button>
            <button
              type="button"
              aria-pressed={props.bountyType === "completed"}
              onClick={() => {
                props.setBountyType("completed");
              }}
              className="cursor-pointer opacity-20 aria-pressed:opacity-100"
            >
              Completed
            </button>
          </div>
        </div>
        {user ? (
          <div className="flex gap-4">
            <p>Show:</p>
            <div className="flex gap-3">
              <button
                type="button"
                aria-pressed={props.relationship === null}
                onClick={() => {
                  props.setRelationship(null);
                }}
                className="cursor-pointer opacity-20 aria-pressed:opacity-100"
              >
                All bounties
              </button>
              <button
                type="button"
                aria-pressed={props.relationship === "created"}
                onClick={() => {
                  props.setRelationship("created");
                }}
                className="cursor-pointer opacity-20 aria-pressed:opacity-100"
              >
                My bounties
              </button>
              <button
                type="button"
                aria-pressed={props.relationship === "bookmarked"}
                onClick={() => {
                  props.setRelationship("bookmarked");
                }}
                className="cursor-pointer opacity-20 aria-pressed:opacity-100"
              >
                Bookmarked bounties
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex gap-4">
          <p>Sort by:</p>
          <div className="flex gap-3">
            <button
              type="button"
              aria-pressed={props.selectedSortingMethod.type === "date"}
              onClick={() =>
                props.setSelectedSortingMethod({
                  type: "date",
                  order: props.selectedSortingMethod.order,
                })
              }
              className="cursor-pointer opacity-20 aria-pressed:opacity-100"
            >
              Date
            </button>
            <button
              type="button"
              aria-pressed={props.selectedSortingMethod.type === "bpReward"}
              onClick={() =>
                props.setSelectedSortingMethod({
                  type: "bpReward",
                  order: props.selectedSortingMethod.order,
                })
              }
              className="cursor-pointer opacity-20 aria-pressed:opacity-100"
            >
              Reward
            </button>
          </div>
        </div>
        <div className="flex gap-4">
          <p>Sort order:</p>
          <div className="flex gap-3">
            <button
              type="button"
              aria-pressed={props.selectedSortingMethod.order === "asc"}
              onClick={() =>
                props.setSelectedSortingMethod({
                  type: props.selectedSortingMethod.type,
                  order: "asc",
                })
              }
              className="cursor-pointer opacity-20 aria-pressed:opacity-100"
            >
              Asc ↑
            </button>
            <button
              type="button"
              aria-pressed={props.selectedSortingMethod.order === "desc"}
              onClick={() =>
                props.setSelectedSortingMethod({
                  type: props.selectedSortingMethod.type,
                  order: "desc",
                })
              }
              className="cursor-pointer opacity-20 aria-pressed:opacity-100"
            >
              Desc ↓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
