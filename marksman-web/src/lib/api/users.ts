import { userSchema } from "@marksman/contracts";
import { apiFetch } from "./client";

export async function getCurrentUser() {
  return userSchema.parse(
    await apiFetch(`/auth/me`, {
      method: "GET",
    }),
  );
}
