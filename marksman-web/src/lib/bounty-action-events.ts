import type { Hunt } from "@marksman/contracts";

type ActionEvent =
  | { type: "hunt-invalidated"; userId: string }
  | { type: "hunt"; userId: string; hunt: Hunt }
  | { type: "bookmark"; userId: string; bountyId: string; bookmarked: boolean };
const listeners = new Set<(event: ActionEvent) => void>();

export function publishBountyAction(event: ActionEvent) {
  for (const listener of listeners) listener(event);
}

export function subscribeBountyActions(listener: (event: ActionEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
