import { Router } from "express";
import { findUserById, listUsers } from "../db/users";
import { queryPageSchema, uuidSchema } from "../models/common";
import { requireAuth } from "../middleware/requireAuth";
import { getBookmarkedBounties } from "../services/bounty-bookmarks";
import { fetchLedgerHistory } from "../services/ledger";
import { getUserBountyEvents } from "../services/bounty-events";
import { UserNotFoundError } from "../services/errors";

export const usersRouter = Router();

usersRouter.get("/", async (_req, res) => {
  const users = await listUsers();
  return res.json(users);
});

usersRouter.get("/:id", async (req, res) => {
  const parsed = uuidSchema.safeParse(req.params.id);

  if (!parsed.success) {
    return res
      .status(400)
      .json({ code: "MALFORMED_USER_ID", error: "Malformed user ID" });
  }

  const user = await findUserById(parsed.data);
  if (!user)
    return res
      .status(404)
      .json({ code: "USER_NOT_FOUND", error: "User not found" });
  return res.json(user);
});

usersRouter.get("/me/bookmarked-bounties", requireAuth, async (req, res) => {
  const userId = res.locals.user.identity.id;

  const bounties = await getBookmarkedBounties(userId);

  return res.json(bounties);
});

usersRouter.get("/me/ledger", requireAuth, async (req, res) => {
  const pageParse = queryPageSchema.safeParse(req.query.page);
  if (!pageParse.success) {
    return res.status(400).json({
      code: "MALFORMED_PAGE_INDEX",
      error: "Malformed page index provided.",
    });
  }

  const userId = res.locals.user.identity.id;

  const entries = await fetchLedgerHistory(userId, pageParse.data);

  return res.json(entries);
});

usersRouter.get("/:id/bounty-events", async (req, res) => {
  const parsedUserId = uuidSchema.safeParse(req.params.id);
  const parsedPageNumber = queryPageSchema.safeParse(req.query.page);

  if (!parsedUserId.success) {
    return res
      .status(400)
      .json({ code: "MALFORMED_USER_ID", error: "Malformed user ID" });
  }

  if (!parsedPageNumber.success) {
    return res.status(400).json({
      code: "MALFORMED_PAGE_INDEX",
      error: "Malformed page index provided.",
    });
  }

  try {
    const events = await getUserBountyEvents(
      parsedUserId.data,
      parsedPageNumber.data,
    );

    return res.json(events);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return res.status(404).json({
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    throw error;
  }
});
