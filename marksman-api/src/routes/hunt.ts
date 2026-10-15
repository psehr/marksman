import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";
import { uuidSchema } from "../models/common";
import { stopHunt } from "../services/bounty-hunts";
import {
  BountyNotFoundError,
  BountyNotOpenError,
  HuntNotOngoingError,
  HuntNotOwnedError,
  HuntNotFoundError,
  UserNotFoundError,
} from "../services/errors";

export const huntsRouter = Router();

huntsRouter.post(
  "/:id/stop",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const parsedHuntId = uuidSchema.safeParse(req.params.id);

    if (!parsedHuntId.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_HUNT_ID", error: "Malformed hunt ID" });
    }

    const identity = res.locals.user.identity;

    try {
      const hunt = await stopHunt(identity, parsedHuntId.data);

      return res.json(hunt);
    } catch (error) {
      if (error instanceof HuntNotFoundError) {
        return res
          .status(404)
          .json({ code: "HUNT_NOT_FOUND", error: error.message });
      }
      if (error instanceof BountyNotFoundError) {
        return res
          .status(404)
          .json({ code: "BOUNTY_NOT_FOUND", error: error.message });
      }
      if (error instanceof UserNotFoundError) {
        return res
          .status(404)
          .json({ code: "USER_NOT_FOUND", error: error.message });
      }
      if (error instanceof HuntNotOwnedError) {
        return res
          .status(403)
          .json({ code: "HUNT_NOT_OWNED", error: error.message });
      }
      if (error instanceof BountyNotOpenError) {
        return res
          .status(409)
          .json({ code: "BOUNTY_NOT_OPEN", error: error.message });
      }
      if (error instanceof HuntNotOngoingError) {
        return res
          .status(409)
          .json({ code: "HUNT_NOT_ONGOING", error: error.message });
      }

      throw error;
    }
  },
);
