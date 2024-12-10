"use server";

import { signIn } from "@/auth";

export async function sign_in() {
  return await signIn("osu");
}
