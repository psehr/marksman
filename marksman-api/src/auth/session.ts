import type { Request } from "express";

// Keep cookie creation and logout clearing aligned.
export const SESSION_COOKIE_NAME = "marksman.sid";
export const SESSION_COOKIE_PATH = "/";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Await these callback APIs so Express 5 can handle failures in async routes.
export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}
