import { BountyEvent } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import {
  linkedRowClassName,
  rowLinkClassName,
  tableClassName,
} from "./historyTableStyles";

export function EventHistory({ events }: { events: BountyEvent[] }) {
  if (!events.length)
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <p className="font-bold">[No events to show]</p>
      </div>
    );

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className={tableClassName}>
        <caption className="sr-only">Bounty Events History</caption>
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[70%]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Date</span>
            </th>
            <th scope="col">
              <span className="sr-only">Event</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            let text_color;

            switch (event.type) {
              case "completed":
                text_color = "text-success";
                break;
              case "cancelled":
                text_color = "text-danger";
                break;
            }

            return (
              <tr
                key={event.bountyId + event.type}
                className={linkedRowClassName}
              >
                <td className="italic text-foreground-muted">
                  <p>{formatDistance(Date.now(), event.timestamp)} ago</p>
                </td>
                <td className="text-end">
                  <Link
                    href={`/bounties/${event.bountyId}`}
                    className={`${rowLinkClassName} ${text_color}`}
                  >
                    {event.type === "created" ? (
                      <p>Funded a new bounty</p>
                    ) : null}
                    {event.type === "completed" ? (
                      <p>
                        {event.winner?.username ?? "Unknown user"} completed{" "}
                        {event.creator?.username ?? "Unknown user"}
                        's bounty
                      </p>
                    ) : null}
                    {event.type === "cancelled" ? (
                      <p>Cancelled a bounty</p>
                    ) : null}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
