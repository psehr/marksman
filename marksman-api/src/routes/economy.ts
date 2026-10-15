import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";
import { attemptDailyClaim } from "../services/economy";

export const economyRouter = Router();

economyRouter.post(
  "/daily-claim",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const user = res.locals.user.identity;

    const dailyClaim = await attemptDailyClaim(user);

    if (dailyClaim) {
      return res.status(200).json({ message: "Daily reward claimed." });
    } else {
      return res.status(409).json({
        code: "DAILY_ALREADY_CLAIMED",
        error: "Daily reward already claimed today.",
      });
    }
  },
);
