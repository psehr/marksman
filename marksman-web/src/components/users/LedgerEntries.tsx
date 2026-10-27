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
    <div className="min-h-0 flex-1 overflow-auto">
      <table className={tableClassName}>
        <caption className="sr-only">BP transaction history</caption>
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[50%]" />
          <col className="w-[20%]" />
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
                className={entry.bountyId ? linkedRowClassName : rowClassName}
              >
                <td className="italic text-foreground-muted">
                  <p>{formatDistance(Date.now(), entry.createdAt)} ago</p>
                </td>
                <td className="text-center">
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
                <td className={`${text_color} font-bold text-end`}>
                  {entry.amount > 0 ? "+" : ""}
                  {entry.amount} BP
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
