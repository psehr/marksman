import { getBountyEventsOfUser } from "../db/bounties";
import { findUserById } from "../db/users";
import { UserNotFoundError } from "./errors";

export async function getUserBountyEvents(userId: string, page: number) {
  const user = await findUserById(userId);

  if (!user) throw new UserNotFoundError();

  const events = await getBountyEventsOfUser(user.identity, page);

  return events;
}
