import Button from "@/components/ui/Button";
import type { BountyEvent, LedgerEntry, User } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";

export function UserCard({ user }: { user: User }) {
  return (
    <div className="size-fit max-w-full wrap-anywhere px-4 p-2 border border-border rounded bg-background text-xl">
      <Link
        className="font-bold underline underline-offset-2"
        href={`https://osu.ppy.sh/users/${user.identity.osuUserId}`}
      >
        {user.identity.username}
      </Link>
      <p>Balance: {user.stats.bpBalance} BP</p>
    </div>
  );
}

export function MainSection({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-6xl bg-surface rounded shadow-md border border-border flex flex-col items-center gap-8 p-4 sm:p-8">
      {children}
    </div>
  );
}

export function DailyClaim({
  claimed,
  claimPending,
  claimMessage,
  claimError,
  claimDailyReward,
}: {
  claimed: boolean;
  claimPending: boolean;
  claimMessage: string | null;
  claimError: string | null;
  claimDailyReward: () => void;
}) {
  return (
    <div className="text-right">
      <Button
        type="button"
        variant="accent"
        disabled={claimPending || claimed}
        onClick={() => void claimDailyReward()}
      >
        {claimPending
          ? "Claiming…"
          : claimed
            ? "Daily BP claimed"
            : "Claim daily 25 BP"}
      </Button>
      {claimMessage ? <p role="status">{claimMessage}</p> : null}
      {claimError ? <p role="alert">{claimError}</p> : null}
    </div>
  );
}

export function LedgerEntries({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) return <p>[No transactions to show]</p>;

  return (
    <table className="w-full table-fixed wrap-anywhere text-left">
      <caption className="sr-only">BP transaction history</caption>
      <colgroup>
        <col className="w-1/4" />
        <col className="w-[55%]" />
        <col className="w-1/5" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Activity</th>
          <th scope="col">BP</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          let color =
            entry.amount > 0
              ? "border-green-400/30 bg-green-400/10 text-green-200"
              : "border-red-400/30 bg-red-400/10 text-red-200";

          let reason_text;

          switch (entry.reason) {
            case "bounty_funding":
              reason_text = "Bounty Funding";
              break;
            case "bounty_refund":
              reason_text = "Bounty Cancellation";
              break;
            case "bounty_fee":
              reason_text = "Bounty Funding Fee";
              break;
            case "bounty_reward":
              reason_text = "Bounty Reward";
              break;
            case "daily_claim":
              reason_text = "Daily Claim";
              break;
            case "initial_grant":
              reason_text = "Account Creation";
              break;
          }
          return (
            <tr key={entry.id} className={`text-sm ${color}`}>
              <td>
                <p>{formatDistance(Date.now(), entry.createdAt)} ago</p>
              </td>
              <td>
                {entry.bountyId ? (
                  <Link
                    href={"/bounties/" + entry.bountyId}
                    className="underline"
                  >
                    {reason_text}↗
                  </Link>
                ) : (
                  reason_text
                )}
              </td>
              <td>
                {entry.amount > 0 ? "+" : ""}
                {entry.amount}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PageSelector({
  entriesLength,
  pageSize,
  selectedPage,
  setSelectedPage,
}: {
  entriesLength: number;
  pageSize: number;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {selectedPage > 1 ? (
        <Button
          size="sm"
          onClick={() => {
            setSelectedPage(selectedPage - 1);
          }}
        >
          {"<"}
        </Button>
      ) : (
        "-"
      )}
      <p>Page {selectedPage}</p>
      {entriesLength < pageSize ? (
        "-"
      ) : (
        <Button
          size="sm"
          onClick={() => {
            setSelectedPage(selectedPage + 1);
          }}
        >
          {">"}
        </Button>
      )}
    </div>
  );
}

export function EventHistory({ events }: { events: BountyEvent[] }) {
  if (!events.length) return <p>[No events to show]</p>;

  return (
    <table className="w-full table-fixed wrap-anywhere text-left">
      <caption className="sr-only">Bounty Events History</caption>
      <colgroup>
        <col className="w-1/4" />
        <col className="w-[55%]" />
        <col className="w-1/5" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Event</th>
          <th scope="col">Bounty</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => {
          let color;

          switch (event.type) {
            case "created":
              color = "border-blue-400/30 bg-blue-400/10 text-blue-200";
              break;
            case "completed":
              color = "border-green-400/30 bg-green-400/10 text-green-200";
              break;
            case "cancelled":
              color = "border-red-400/30 bg-red-400/10 text-red-200";
              break;
          }

          return (
            <tr
              key={event.bountyId + event.type}
              className={`${color} text-sm`}
            >
              <td>
                <p>{formatDistance(Date.now(), event.timestamp)} ago</p>
              </td>
              <td>
                {event.type === "created" ? <p>Funded a new bounty</p> : null}
                {event.type === "completed" ? (
                  <p>
                    {event.winner?.username ?? "Unknown user"} completed{" "}
                    {event.creator?.username ?? "Unknown user"}
                    's bounty
                  </p>
                ) : null}
                {event.type === "cancelled" ? <p>Cancelled a bounty</p> : null}
              </td>
              <td>
                <Link
                  href={`/bounties/${event.bountyId}`}
                  className="underline"
                >
                  Link
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
