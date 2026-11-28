import { Router } from "express";
import { z } from "zod";
import { getBeatmap } from "../integrations/osu/beatmaps";
import { BeatmapNotFoundError, OsuApiError } from "../services/errors";
import { searchBeatmaps } from "../services/beatmap-search";
import { beatmapSearchRequestSchema } from "@marksman/contracts";

const beatmapIdSchema = z.coerce.number().int().positive();

export const beatmapsRouter = Router();

beatmapsRouter.get("/search", async (req, res) => {
  const parsedQuery = beatmapSearchRequestSchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      code: "MALFORMED_SEARCH_QUERY",
      error: "Invalid search query provided",
    });
  }

  try {
    const beatmapsets = await searchBeatmaps({
      query: parsedQuery.data.query,
      cursor: parsedQuery.data.cursor,
    });
    return res.json(beatmapsets);
  } catch (error) {
    if (error instanceof OsuApiError)
      return res.status(502).json({
        code: "UNABLE_TO_SEARCH",
        error: "Unable to search beatmaps. Please try again.",
      });

    throw error;
  }
});

beatmapsRouter.get("/:id", async (req, res) => {
  const parsedId = beatmapIdSchema.safeParse(req.params.id);

  if (!parsedId.success)
    return res
      .status(400)
      .json({ code: "MALFORMED_BEATMAP_ID", error: "Malformed beatmap ID" });

  try {
    const beatmap = await getBeatmap(parsedId.data);
    return res.json(beatmap);
  } catch (error) {
    if (error instanceof BeatmapNotFoundError) {
      return res
        .status(404)
        .json({ code: "BEATMAP_NOT_FOUND", error: error.message });
    }

    return res.status(502).json({
      code: "UNAVAILABLE_METADATA",
      error: "Unable to retrieve beatmap metadata. Please try again.",
    });
  }
});
