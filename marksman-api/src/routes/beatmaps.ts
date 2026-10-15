import { Router } from "express";
import { z } from "zod";
import { getBeatmap } from "../integrations/osu/beatmaps";
import { BeatmapNotFoundError } from "../services/errors";

const beatmapIdSchema = z.coerce.number().int().positive();

export const beatmapsRouter = Router();

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
