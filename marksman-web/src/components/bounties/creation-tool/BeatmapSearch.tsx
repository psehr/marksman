"use client";

import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { useBeatmapSearch } from "@/hooks/useBeatmapSearch";
import { parseBeatmapSearchInput } from "./creation-tool.utils";

type BeatmapSearchProps = {
  onSelect: (beatmapId: number) => void;
};

export default function BeatmapSearch({ onSelect }: BeatmapSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const search = useBeatmapSearch();
  const loading =
    search.status === "loading" || search.status === "loading-more";

  const selectBeatmap = (id: number) => {
    search.reset();
    setInputError(null);
    onSelect(id);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 text-start">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!query.trim()) return;
          setInputError(null);
          const input = parseBeatmapSearchInput(query);
          if (input.type === "difficulty") {
            selectBeatmap(input.id);
          } else if (input.type === "search") {
            void search.search(input.query);
          } else {
            setInputError("Enter an official osu! beatmap or beatmapset URL.");
          }
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Search beatmaps
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            id={inputId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setInputError(null);
            }}
            placeholder="Song, artist, mapper, ID or URL"
            size="lg"
            maxLength={200}
            required
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={!query.trim()}>
            Search
          </Button>
        </div>
      </form>

      {inputError ? (
        <p role="alert" className="text-sm text-danger">
          {inputError}
        </p>
      ) : null}

      {loading ? (
        <p role="status" className="text-sm text-foreground-muted">
          {search.status === "loading-more"
            ? "Loading more beatmaps…"
            : "Searching beatmaps…"}
        </p>
      ) : null}

      {search.error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-danger">
            {search.error}
          </p>
          <Button type="button" onClick={() => void search.retry()}>
            Retry
          </Button>
        </div>
      ) : null}

      {search.beatmapsets.length > 0 ? (
        <ul
          aria-label="Beatmap search results"
          className="flex min-w-0 flex-col gap-3"
        >
          {search.beatmapsets.map((set) => (
            <li
              key={set.id}
              className="min-w-0 overflow-hidden rounded border border-border"
            >
              <div className="flex items-center gap-3 bg-background p-3">
                <div
                  aria-hidden="true"
                  className="h-14 w-20 shrink-0 rounded bg-cover bg-center"
                  style={{ backgroundImage: `url("${set.covers.card}")` }}
                />
                <div className="min-w-0 break-words">
                  <h3 className="font-bold">{set.title}</h3>
                  <p className="text-sm text-foreground-muted">{set.artist}</p>
                  <p className="text-xs text-foreground-muted">
                    Mapped by {set.creator}
                  </p>
                </div>
              </div>
              <ul
                aria-label={`Difficulties for ${set.title}`}
                className="flex flex-wrap gap-2 p-3"
              >
                {[...set.beatmaps]
                  .sort(
                    (a, b) =>
                      a.difficulty_rating - b.difficulty_rating || a.id - b.id,
                  )
                  .map((map) => (
                    <li key={map.id} className="min-w-0 max-w-full">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto! min-h-8 max-w-full whitespace-normal! break-words py-1 text-start text-xs!"
                        aria-label={`Select ${set.artist} - ${set.title} [${map.version}]`}
                        onClick={() => selectBeatmap(map.id)}
                      >
                        {map.version}
                      </Button>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : search.status === "success" ? (
        <p role="status" className="text-sm text-foreground-muted">
          No results found.
        </p>
      ) : null}

      {search.beatmapsets.length > 0 ? (
        <nav
          aria-label="Beatmap search pages"
          className="flex items-center justify-between gap-2"
        >
          <Button
            type="button"
            disabled={loading || !search.hasPrevious}
            onClick={search.previousPage}
          >
            Previous
          </Button>
          <span role="status" className="text-sm text-foreground-muted">
            Page {search.page}
          </span>
          <Button
            type="button"
            disabled={loading || search.status === "error" || !search.hasNext}
            onClick={() => void search.nextPage()}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
