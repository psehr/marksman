import { useCallback, useEffect, useRef, useState } from "react";
import { searchBeatmaps } from "@/lib/api/beatmaps";
import {
  beatmapSearchRequestSchema,
  type BeatmapSearchSet,
} from "@marksman/contracts";

type SearchState = {
  query: string;
  beatmapsets: BeatmapSearchSet[];
  total: number;
  cursor: string | null;
  status: "idle" | "loading" | "loading-more" | "success" | "error";
  error: string | null;
  page: number;
};

const PAGE_SIZE = 3;

const initialState: SearchState = {
  query: "",
  beatmapsets: [],
  total: 0,
  cursor: null,
  status: "idle",
  error: null,
  page: 0,
};

export function useBeatmapSearch() {
  const [state, setState] = useState<SearchState>(initialState);
  const current = useRef(state);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const failedRequest = useRef<{
    query: string;
    cursor?: string;
    page: number;
  } | null>(null);

  const update = useCallback((next: SearchState) => {
    current.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      controller.current?.abort();
    };
  }, []);

  const request = useCallback(
    async (query: string, cursor?: string, page = 0) => {
      if (!mounted.current) return;
      const revision = ++generation.current;
      controller.current?.abort();
      const abortController = new AbortController();
      controller.current = abortController;
      failedRequest.current = null;

      const parsed = beatmapSearchRequestSchema.safeParse({ query, cursor });
      if (!parsed.success) {
        update({
          ...initialState,
          status: "error",
          error: "Enter a search query of 1–200 characters.",
        });
        return;
      }

      let base = cursor
        ? current.current
        : { ...initialState, query: parsed.data.query };
      update({
        ...base,
        status: cursor ? "loading-more" : "loading",
        error: null,
      });

      let requestCursor = parsed.data.cursor;
      try {
        const seenCursors = new Set<string>();
        do {
          if (requestCursor) {
            if (seenCursors.has(requestCursor))
              throw new Error("Search cursor repeated");
            seenCursors.add(requestCursor);
          }
          const response = await searchBeatmaps(
            { query: parsed.data.query, cursor: requestCursor },
            abortController.signal,
          );
          if (!mounted.current || revision !== generation.current) return;

          // Keep upstream pages cached; overlapping sets and difficulties merge by ID.
          const sets = new Map(base.beatmapsets.map((set) => [set.id, set]));
          for (const set of response.beatmapsets) {
            const previous = sets.get(set.id);
            const maps = new Map(
              previous?.beatmaps.map((map) => [map.id, map]),
            );
            for (const map of set.beatmaps) maps.set(map.id, map);
            sets.set(set.id, { ...set, beatmaps: [...maps.values()] });
          }
          base = {
            ...base,
            query: parsed.data.query,
            beatmapsets: [...sets.values()],
            total: response.total,
            cursor: response.cursor || null,
          };
          requestCursor = response.cursor || undefined;
          // Filtered or overlapping upstream pages may not fill a visible page.
        } while (
          requestCursor &&
          base.beatmapsets.length < (page + 1) * PAGE_SIZE
        );
        update({
          ...base,
          page: Math.min(
            page,
            Math.max(0, Math.ceil(base.beatmapsets.length / PAGE_SIZE) - 1),
          ),
          status: "success",
          error: null,
        });
      } catch {
        if (!mounted.current || revision !== generation.current) return;
        failedRequest.current = {
          query: parsed.data.query,
          cursor: requestCursor,
          page,
        };
        update({
          ...base,
          status: "error",
          error: "Unable to search beatmaps. Please try again.",
        });
      } finally {
        if (revision === generation.current) controller.current = null;
      }
    },
    [update],
  );

  const search = useCallback((query: string) => request(query), [request]);

  const nextPage = useCallback(async () => {
    const latest = current.current;
    if (!mounted.current || latest.status !== "success") return;
    const page = latest.page + 1;
    if (latest.beatmapsets.length >= (page + 1) * PAGE_SIZE || !latest.cursor) {
      if (latest.beatmapsets.length > page * PAGE_SIZE)
        update({ ...latest, page });
      return;
    }
    await request(latest.query, latest.cursor, page);
  }, [request, update]);

  const previousPage = useCallback(() => {
    const latest = current.current;
    if (
      !mounted.current ||
      latest.page === 0 ||
      latest.status === "loading" ||
      latest.status === "loading-more"
    )
      return;
    failedRequest.current = null;
    update({
      ...latest,
      page: latest.page - 1,
      status: "success",
      error: null,
    });
  }, [update]);

  const retry = useCallback(async () => {
    const failed = failedRequest.current;
    if (failed) await request(failed.query, failed.cursor, failed.page);
  }, [request]);

  const reset = useCallback(() => {
    if (!mounted.current) return;
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    failedRequest.current = null;
    update(initialState);
  }, [update]);

  return {
    ...state,
    beatmapsets: state.beatmapsets.slice(
      state.page * PAGE_SIZE,
      (state.page + 1) * PAGE_SIZE,
    ),
    page: state.page + 1,
    hasPrevious: state.page > 0,
    hasNext:
      (state.page + 1) * PAGE_SIZE < state.beatmapsets.length ||
      Boolean(state.cursor),
    search,
    nextPage,
    previousPage,
    retry,
    reset,
  };
}
