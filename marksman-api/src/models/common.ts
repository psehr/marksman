import { z } from "zod";

export const uuidSchema = z.uuid();
export const osuIdParamSchema = z.coerce.number().int().positive();
export const queryPageSchema = z.coerce.number().int().positive().default(1);
