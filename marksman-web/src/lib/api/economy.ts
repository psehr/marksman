import { apiFetch } from "./client";

export async function claimDailyBp(): Promise<void> {
  // The success message is not consumed; HTTP status determines the outcome.
  await apiFetch("/economy/daily-claim", { method: "POST" });
}
