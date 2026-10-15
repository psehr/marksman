import type { Request, Response, NextFunction } from "express";
import { findUserById } from "../db/users";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.session.userId;

  if (!userId) {
    return res
      .status(401)
      .json({ code: "NOT_LOGGED_IN", error: "Not logged in" });
  }

  // Reload the account so deleted users cannot authenticate and balances stay current.
  try {
    const user = await findUserById(userId);

    if (!user) {
      return res
        .status(401)
        .json({ code: "NOT_LOGGED_IN", error: "Not logged in" });
    }

    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
