import { Router } from "express";
import { db } from "../db";
import { findBountyById, listBounties } from "../db/bounties";
import {
  bountyCompletionRequestSchema,
  bountySearchQuerySchema,
  createBountySchema,
} from "@marksman/contracts";
import { osuIdParamSchema, uuidSchema } from "../models/common";
import { cancelBounty, createFundedBounty } from "../services/bounties";

import {
  BeatmapMetadataUnavailableError,
  BeatmapNotFoundError,
  BountyNotFoundError,
  BountyNotOpenError,
  BountyNotOwnedError,
  BountyOwnBookmarkError,
  BountyOwnHuntError,
  CreatorNotFoundError,
  DuplicateHuntingError,
  HuntSlotsFullError,
  InsufficientBpError,
  InvalidBeatmapMetadataError,
  OsuApiError,
  PayoutRecipientNotFoundError,
  ScoreNotFoundError,
  UnsupportedBeatmapStatusError,
  UnsupportedGameModeError,
  UserNotFoundError,
} from "../services/errors";
import { requireAuth } from "../middleware/requireAuth";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin";
import { attemptBountyCompletion } from "../services/bounty-completion";
import { bookmarkBounty, unbookmarkBounty } from "../services/bounty-bookmarks";
import { enrichBounties, enrichBounty } from "../services/bounty-enrichment";
import { getBountyRecentScores } from "../services/bounty-recent-scores";
import { getBountyScorePreview } from "../services/bounty-score-preview";
import { startHunt } from "../services/bounty-hunts";
import { findUserById } from "../db/users";

export const bountiesRouter = Router();

bountiesRouter.get("/", async (req, res) => {
  const parsedQuery = bountySearchQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      code: "INVALID_BOUNTY_LIST_QUERY",
      error: "Invalid bounty list query",
    });
  }

  const identity = req.session.userId
    ? (await findUserById(req.session.userId))?.identity
    : undefined;

  const bounties = await listBounties(parsedQuery.data, identity);

  const extendedBounties = await enrichBounties(bounties.items);

  return res.json({ ...bounties, items: extendedBounties });
});

bountiesRouter.get("/:id", async (req, res) => {
  const parsed = uuidSchema.safeParse(req.params.id);

  const userId = req.session.userId;

  if (!parsed.success) {
    return res
      .status(400)
      .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
  }

  const bounty = await findBountyById(db, parsed.data);
  if (!bounty) {
    return res
      .status(404)
      .json({ code: "BOUNTY_NOT_FOUND", error: "Bounty not found" });
  }

  const extendedBounty = await enrichBounty(bounty, userId);

  return res.json(extendedBounty);
});

bountiesRouter.get("/:id/recent-scores", requireAuth, async (req, res) => {
  const parsedBountyId = uuidSchema.safeParse(req.params.id);

  const user = res.locals.user.identity;

  if (!parsedBountyId.success) {
    return res
      .status(400)
      .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
  }

  try {
    const possibleRecentScores = await getBountyRecentScores(
      parsedBountyId.data,
      user,
    );

    return res.json(possibleRecentScores);
  } catch (error) {
    if (error instanceof BountyNotFoundError) {
      return res
        .status(404)
        .json({ code: "BOUNTY_NOT_FOUND", error: "Bounty not found" });
    }

    if (error instanceof OsuApiError) {
      return res
        .status(502)
        .json({ code: "OSU_API_ERROR", error: error.message });
    }

    if (error instanceof BeatmapMetadataUnavailableError) {
      return res
        .status(502)
        .json({ code: "UNAVAILABLE_BEATMAP_METADATA", error: error.message });
    }

    if (error instanceof InvalidBeatmapMetadataError) {
      return res
        .status(502)
        .json({ code: "INVALID_BEATMAP_METADATA", error: error.message });
    }
    throw error;
  }
});

bountiesRouter.get(
  "/:id/scores/:scoreId/preview",
  requireAuth,
  async (req, res) => {
    const parsedBountyId = uuidSchema.safeParse(req.params.id);
    const parsedScoreId = osuIdParamSchema.safeParse(req.params.scoreId);

    const user = res.locals.user.identity;

    if (!parsedBountyId.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
    }

    if (!parsedScoreId.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_SCORE_ID", error: "Malformed score ID" });
    }

    try {
      const scorePreview = await getBountyScorePreview(
        parsedBountyId.data,
        parsedScoreId.data,
        user,
      );

      return res.json(scorePreview);
    } catch (error) {
      if (error instanceof BountyNotFoundError) {
        return res
          .status(404)
          .json({ code: "BOUNTY_NOT_FOUND", error: "Bounty not found" });
      }

      if (error instanceof ScoreNotFoundError) {
        return res
          .status(404)
          .json({ code: "SCORE_NOT_FOUND", error: "Score not found" });
      }

      if (error instanceof OsuApiError) {
        return res
          .status(502)
          .json({ code: "OSU_API_ERROR", error: error.message });
      }

      if (error instanceof BeatmapMetadataUnavailableError) {
        return res
          .status(502)
          .json({ code: "UNAVAILABLE_BEATMAP_METADATA", error: error.message });
      }

      if (error instanceof InvalidBeatmapMetadataError) {
        return res
          .status(502)
          .json({ code: "INVALID_BEATMAP_METADATA", error: error.message });
      }

      throw error;
    }
  },
);

bountiesRouter.post(
  "/",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const parsed = createBountySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        code: "INVALID_CREATE_BOUNTY_INPUT",
        error: "Invalid create bounty input",
        details: parsed.error.issues,
      });
    }

    try {
      const createdBounty = await createFundedBounty(
        parsed.data,
        res.locals.user.identity.osuUserId,
      );
      return res
        .status(201)
        .json({ message: "Bounty created", bounty: createdBounty });
    } catch (error) {
      if (error instanceof CreatorNotFoundError) {
        return res.status(404).json({
          code: "CREATOR_NOT_FOUND",
          error: error.message,
        });
      }

      if (error instanceof InsufficientBpError) {
        return res.status(409).json({
          code: "INSUFFICIENT_BP",
          error: error.message,
        });
      }

      if (error instanceof UnsupportedGameModeError) {
        return res.status(422).json({
          code: "UNSUPPORTED_MODE",
          error: error.message,
        });
      }

      if (error instanceof UnsupportedBeatmapStatusError) {
        return res.status(422).json({
          code: "UNSUPPORTED_BEATMAP_STATUS",
          error: error.message,
        });
      }

      if (error instanceof BeatmapNotFoundError) {
        return res.status(404).json({
          code: "BEATMAP_NOT_FOUND",
          error: error.message,
        });
      }

      if (error instanceof OsuApiError) {
        return res.status(502).json({
          code: "OSU_API_ERROR",
          error: error.message,
        });
      }

      throw error;
    }
  },
);

bountiesRouter.post(
  "/:id/cancel",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const parsed = uuidSchema.safeParse(req.params.id);

    if (!parsed.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
    }

    try {
      const cancelledBounty = await cancelBounty(
        parsed.data,
        res.locals.user.identity.osuUserId,
      );
      return res
        .status(200)
        .json({ message: "Bounty cancelled", bounty: cancelledBounty });
    } catch (error) {
      if (error instanceof BountyNotFoundError) {
        return res
          .status(404)
          .json({ code: "BOUNTY_NOT_FOUND", error: error.message });
      }
      if (error instanceof BountyNotOwnedError) {
        return res
          .status(403)
          .json({ code: "BOUNTY_NOT_OWNED", error: error.message });
      }
      if (error instanceof BountyNotOpenError) {
        return res
          .status(409)
          .json({ code: "BOUNTY_NOT_OPEN", error: error.message });
      }

      throw error;
    }
  },
);

bountiesRouter.post(
  "/:id/complete",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const parsedBountyId = uuidSchema.safeParse(req.params.id);

    if (!parsedBountyId.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
    }

    const parsedBody = bountyCompletionRequestSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_SCORE_ID", error: "Malformed score ID" });
    }

    try {
      const bountyCompletion = await attemptBountyCompletion(
        parsedBody.data.scoreId,
        parsedBountyId.data,
        res.locals.user.identity,
      );

      if (!bountyCompletion.completed) {
        return res.status(422).json({
          code: "SCORE_DOES_NOT_QUALIFY",
          error: "This submission does not qualify for bounty completion",
        });
      }

      return res
        .status(200)
        .json({ message: "Bounty completed", bounty: bountyCompletion.bounty });
    } catch (error) {
      if (error instanceof BountyNotFoundError) {
        return res
          .status(404)
          .json({ code: "BOUNTY_NOT_FOUND", error: error.message });
      }
      if (error instanceof BountyNotOpenError) {
        return res
          .status(409)
          .json({ code: "BOUNTY_NOT_OPEN", error: error.message });
      }
      if (error instanceof ScoreNotFoundError) {
        return res
          .status(404)
          .json({ code: "SCORE_NOT_FOUND", error: error.message });
      }
      if (error instanceof BeatmapMetadataUnavailableError) {
        return res
          .status(502)
          .json({ code: "UNAVAILABLE_METADATA", error: error.message });
      }
      if (error instanceof OsuApiError) {
        return res
          .status(502)
          .json({ code: "OSU_API_ERROR", error: error.message });
      }
      if (error instanceof InvalidBeatmapMetadataError) {
        return res
          .status(502)
          .json({ code: "INVALID_METADATA", error: error.message });
      }
      if (error instanceof PayoutRecipientNotFoundError) {
        return res
          .status(500)
          .json({ code: "UNAVAILABLE_CLAIMANT", error: error.message });
      }

      throw error;
    }
  },
);

bountiesRouter.post(
  "/:id/bookmark",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const parsedBountyId = uuidSchema.safeParse(req.params.id);

    if (!parsedBountyId.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
    }

    const user = res.locals.user.identity;

    try {
      await bookmarkBounty(user, parsedBountyId.data);

      return res.status(204).send();
    } catch (error) {
      if (error instanceof BountyNotFoundError) {
        return res
          .status(404)
          .json({ code: "BOUNTY_NOT_FOUND", error: error.message });
      }
      if (error instanceof BountyNotOpenError) {
        return res
          .status(409)
          .json({ code: "BOUNTY_NOT_OPEN", error: error.message });
      }
      if (error instanceof BountyOwnBookmarkError) {
        return res
          .status(403)
          .json({ code: "BOUNTY_OWN_BOOKMARK", error: error.message });
      }

      throw error;
    }
  },
);

bountiesRouter.post(
  "/:id/unbookmark",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const parsedBountyId = uuidSchema.safeParse(req.params.id);

    if (!parsedBountyId.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
    }

    const userId = res.locals.user.identity.id;

    try {
      await unbookmarkBounty(userId, parsedBountyId.data);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof BountyNotFoundError) {
        return res
          .status(404)
          .json({ code: "BOUNTY_NOT_FOUND", error: error.message });
      }

      throw error;
    }
  },
);

bountiesRouter.post(
  "/:id/hunt",
  requireAuth,
  requireTrustedOrigin,
  async (req, res) => {
    const parsedBountyId = uuidSchema.safeParse(req.params.id);

    if (!parsedBountyId.success) {
      return res
        .status(400)
        .json({ code: "MALFORMED_BOUNTY_ID", error: "Malformed bounty ID" });
    }

    const identity = res.locals.user.identity;

    try {
      const hunt = await startHunt(identity, parsedBountyId.data);

      return res.json(hunt);
    } catch (error) {
      if (error instanceof BountyNotFoundError) {
        return res
          .status(404)
          .json({ code: "BOUNTY_NOT_FOUND", error: error.message });
      }
      if (error instanceof BountyNotOpenError) {
        return res
          .status(409)
          .json({ code: "BOUNTY_NOT_OPEN", error: error.message });
      }
      if (error instanceof BountyOwnHuntError) {
        return res
          .status(403)
          .json({ code: "BOUNTY_OWN_HUNT", error: error.message });
      }
      if (error instanceof UserNotFoundError) {
        return res
          .status(404)
          .json({ code: "USER_NOT_FOUND", error: error.message });
      }
      if (error instanceof HuntSlotsFullError) {
        return res
          .status(409)
          .json({ code: "HUNT_SLOTS_FULL", error: error.message });
      }
      if (error instanceof DuplicateHuntingError) {
        return res
          .status(409)
          .json({ code: "DUPLICATE_HUNTING", error: error.message });
      }

      throw error;
    }
  },
);
