import type { User } from "@marksman/contracts";

declare global {
  namespace Express {
    interface Locals {
      user: User;
    }
  }
}
