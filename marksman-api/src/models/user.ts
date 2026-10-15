import { z } from "zod";
import { userIdentitySchema, userSchema } from "@marksman/contracts";

export const createUserSchema = userIdentitySchema.pick({
  osuUserId: true,
  username: true,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
