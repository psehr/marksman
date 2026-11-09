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
    <div className="min-h-0 flex-1 overflow-auto pr-2">
      <table className={tableClassName}>
        <caption className="sr-only">Bounty Events History</caption>
        <colgroup>
          <col className="w-[35%]" />
          <col className="w-[65%]" />
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
              case "created":
                text_color = "text-info";
                break;
              case "hunt_started":
                text_color = "text-accent";
                break;
              case "hunt_ended":
                text_color = "text-danger";
                break;
            }

            return (
              <tr
                key={event.bountyId + event.type + event.timestamp}
                className={linkedRowClassName}
              >
                <td className="italic text-foreground-muted">
                  <p>
                    {formatDistance(event.timestamp, Date.now(), {
                      addSuffix: true,
                    })}
                  </p>
                </td>
                <td className="text-end">
                  <Link
                    href={`/bounties/${event.bountyId}`}
                    className={`${rowLinkClassName} ${text_color} flex place-content-end gap-2 group`}
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
                    {event.type === "hunt_started" ? (
                      <p>Started hunting a bounty</p>
                    ) : null}
                    {event.type === "hunt_ended" ? <p>Hunt ended</p> : null}
                    <span
                      className="text-foreground-muted group-hover:font-bold group-hover:text-accent group-focus-within:text-accent"
                      aria-hidden="true"
                    >
                      ›
                    </span>
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
