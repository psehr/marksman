import { User } from "@marksman/contracts";
import { db } from "../db";
import { upsertUserFromOsuProfile } from "../db/users";
import { CreateUserInput } from "../models/user";

export async function registerOrUpdateUserFromOsuProfile(
  input: CreateUserInput,
): Promise<User> {
  return db.transaction(async (tx) => {
    return upsertUserFromOsuProfile(tx, input);
  });
}
