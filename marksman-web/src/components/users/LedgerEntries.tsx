import { LedgerEntry } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import {
  linkedRowClassName,
  rowClassName,
  rowLinkClassName,
  tableClassName,
} from "./historyTableStyles";

export function LedgerEntries({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length)
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <p className="font-bold">[No transactions to show]</p>
      </div>
    );

  return (
    <div className="min-h-0 flex-1 overflow-auto pr-2">
      <table className={tableClassName}>
        <caption className="sr-only">BP transaction history</caption>
        <colgroup>
          <col className="w-[35%]" />
          <col className="w-[25%] sm:w-[30%]" />
          <col className="w-[40%] sm:w-[35%]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Date</span>
            </th>
            <th scope="col">
              <span className="sr-only">Transaction</span>
            </th>
            <th scope="col">
              <span className="sr-only">Amount</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            let text_color = entry.amount > 0 ? "text-success" : "text-danger";

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
              <tr
                key={entry.id}
                className={
                  entry.bountyId ? linkedRowClassName + " group" : rowClassName
                }
              >
                <td className="italic text-foreground-muted">
                  <p>
                    {formatDistance(entry.createdAt, Date.now(), {
                      addSuffix: true,
                    })}
                  </p>
                </td>
                <td className={`text-end ${text_color}`}>
                  {entry.bountyId ? (
                    <Link
                      href={"/bounties/" + entry.bountyId}
                      className={rowLinkClassName}
                    >
                      {reason_text}
                    </Link>
                  ) : (
                    reason_text
                  )}
                </td>
                <td className={`${text_color} font-bold`}>
                  <div className="flex items-center justify-between gap-1 text-xs whitespace-nowrap sm:gap-2 sm:text-sm">
                    <span>
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount} BP
                    </span>
                    {entry.bountyId ? (
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-foreground-muted font-normal group-hover:font-bold group-hover:text-accent group-focus-within:text-accent"
                      >
                        ›
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
