"use client";

import { useBeatmapMetadata } from "@/hooks/useBeatmapMetadata";
import { createBountySchema } from "@marksman/contracts";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const mods = ["EZ", "HD", "HR", "DT", "HT", "FL", "NF", "SO"] as const;
const grades = ["D", "C", "B", "A", "S", "SH", "X", "XH"] as const;
const gradeLabels: Record<string, string> = {
  SH: "Silver S",
  X: "SS",
  XH: "Silver SS",
};
type ModRule = "any" | "exact" | "includes" | "excludes";

function beatmapIdFromInput(input: string): number | undefined {
  const value = input.trim();
  let digits: string | undefined;
  if (/^\d+$/.test(value)) {
    digits = value;
  } else {
    try {
      const url = new URL(value);
      if (url.hostname !== "osu.ppy.sh" || url.protocol !== "https:") return;
      digits = /^\/(?:beatmaps|b)\/(\d+)\/?$/.exec(url.pathname)?.[1];
      if (!digits && /^\/beatmapsets\/\d+\/?$/.test(url.pathname)) {
        digits = /^#(?:osu|taiko|fruits|mania)\/(\d+)$/.exec(url.hash)?.[1];
      }
    } catch {
      return;
    }
  }
  const id = Number(digits);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export default function CreateBountyForm() {
  const FEE_PERCENTAGE = 10;
  const FEE_MULT = FEE_PERCENTAGE / 100;

  const [beatmap, setBeatmap] = useState("");
  const [goalType, setGoalType] = useState("minimum_grade");
  const [grade, setGrade] = useState("A");
  const [combo, setCombo] = useState("99");
  const [accuracy, setAccuracy] = useState("");
  const [modRule, setModRule] = useState<ModRule>("any");
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [reward, setReward] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const beatmapId = beatmapIdFromInput(beatmap);

  const {
    beatmapMetadata,
    beatmapLookupStatus,
    retryLookup,
    beatmapLookupError,
  } = useBeatmapMetadata(beatmapId);

  const submitting = useRef(false);

  const {
    user,
    loading: accountLoading,
    error: accountError,
    refreshUser,
  } = useAuth();

  const result = createBountySchema.safeParse({
    rewardBp: reward.trim() ? Number(reward) : undefined,
    goal: {
      type: goalType,
      beatmapId,
      ...(goalType === "minimum_grade"
        ? { minimumGradeRequirement: grade }
        : {
            minimumComboRatio: combo.trim() ? Number(combo) / 100 : undefined,
          }),
      ...(accuracy.trim() ? { minimumAccuracy: Number(accuracy) } : {}),
      modRequirement:
        modRule === "any"
          ? { rule: "any" }
          : { rule: modRule, mods: selectedMods },
    },
  });

  const issues = result.success
    ? []
    : result.error.issues.map((issue) =>
        issue.path.join(".") === "goal.beatmapId"
          ? "Enter a positive beatmap ID or an osu! URL for a specific difficulty."
          : `${issue.path.join(".")}: ${issue.message}`,
      );

  if (goalType === "full_combo" && !combo.trim())
    issues.push("Enter the minimum combo percentage.");

  const balance =
    !accountLoading && user !== null ? user.stats.bpBalance : null;

  const fee = result.success ? Math.ceil(result.data.rewardBp * FEE_MULT) : 0;

  const total_cost = result.success ? result.data.rewardBp + fee : 0;

  const insufficient =
    result.success && balance !== null && total_cost > balance;

  const modSummary =
    modRule === "any"
      ? "Any mods allowed"
      : modRule === "exact"
        ? selectedMods.length
          ? `Only ${selectedMods.join(" + ")}`
          : "No mods"
        : modRule === "includes"
          ? `Must include: ${selectedMods.join(" + ") || "select mods"}`
          : `Must exclude: ${selectedMods.join(" + ") || "select mods"}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || created) return;
    setSubmitted(true);
    setError(null);
    if (!result.success || issues.length || insufficient || accountLoading || user === null)
      return;
    submitting.current = true;
    setPending(true);
    try {
      const response = await fetch(`${apiUrl}/bounties`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      if (response.status === 401) {
        setError(
          "Your session expired. Log in again before creating the bounty.",
        );
        await refreshUser();
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (body?.code === "INSUFFICIENT_BP") {
          setError(
            "You no longer have enough BP for this reward / fee. Your balance is being refreshed.",
          );
          await refreshUser();
        } else {
          setError(
            response.status === 403
              ? "This request was refused. Check that you opened the configured website address."
              : "The bounty could not be created. Your inputs are preserved; check your bounties before trying again.",
          );
        }
        return;
      }
      setCreated(true);
      await refreshUser();
    } catch {
      setError(
        "Could not confirm creation. Check your bounties before retrying, because the request may have succeeded.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const inputClass = "w-full rounded border border-gray-500 bg-transparent p-2";

  return (
    <div className="space-y-6">
      {accountLoading && <p role="status">Loading account…</p>}
      {!accountLoading && user !== null && (
        <p>
          Signed-in as {user.identity.username} · Available balance: {balance}{" "}
          BP
        </p>
      )}
      {!accountLoading && !accountError && user === null && (
        <p>
          Log in to create a bounty.{" "}
          <a className="underline" href={`${apiUrl}/auth/osu`}>
            Log in with osu!
          </a>
        </p>
      )}
      {!accountLoading && accountError !== null && (
        <p role="alert">
          Could not load your balance.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => refreshUser()}
          >
            Retry account lookup
          </button>
        </p>
      )}
      {created && (
        <div role="status" className="space-y-2 rounded border p-4">
          <p>Bounty created! It is now open.</p>
          <Link className="underline" href="/bounties">
            View open bounties
          </Link>
          <button
            type="button"
            className="ml-4 underline"
            onClick={() => {
              setCreated(false);
              setSubmitted(false);
              setReward("");
            }}
          >
            Create another bounty
          </button>
        </div>
      )}
      <form
        onSubmit={submit}
        noValidate
        autoComplete="off"
        className="space-y-6"
      >
        <fieldset
          disabled={pending || created}
          className="grid gap-6 disabled:opacity-60 md:grid-cols-2"
        >
          <legend className="sr-only">Bounty requirements</legend>
          <div className="space-y-4">
            <label className="block">
              Beatmap ID or difficulty URL
              <input
                className={inputClass}
                value={beatmap}
                onChange={(e) => setBeatmap(e.target.value)}
                placeholder="123456 or https://osu.ppy.sh/beatmapsets/…#osu/…"
                required
              />
            </label>
            <p className="text-sm">
              Use a specific difficulty, not just a beatmapset. Open the map
              link in the preview to check your selection.
            </p>
            <label className="block">
              Goal
              <select
                className={inputClass}
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
              >
                <option value="minimum_grade">Minimum grade</option>
                <option value="full_combo">Full combo (combo threshold)</option>
              </select>
            </label>
            {goalType === "minimum_grade" ? (
              <label className="block">
                Minimum grade
                <select
                  className={inputClass}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  {grades.map((value) => (
                    <option key={value} value={value}>
                      {gradeLabels[value] ?? value}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                Minimum combo (%)
                <input
                  className={inputClass}
                  type="number"
                  min="0.01"
                  max="100"
                  step="any"
                  value={combo}
                  onChange={(e) => setCombo(e.target.value)}
                  required
                />
                <span className="text-sm">
                  99 means at least 99% of the map’s maximum combo.
                </span>
              </label>
            )}
            <label className="block">
              Minimum accuracy (%) — optional
              <input
                className={inputClass}
                type="number"
                min="0"
                max="100"
                step="any"
                value={accuracy}
                onChange={(e) => setAccuracy(e.target.value)}
              />
            </label>
            <label className="block">
              Mod rule
              <select
                className={inputClass}
                value={modRule}
                onChange={(e) => setModRule(e.target.value as ModRule)}
              >
                <option value="any">Any mods</option>
                <option value="exact">Exactly these mods</option>
                <option value="includes">Include these mods</option>
                <option value="excludes">Exclude these mods</option>
              </select>
            </label>
            {modRule !== "any" && (
              <fieldset className="space-y-2">
                <legend>Mods</legend>
                <div className="flex flex-wrap gap-3">
                  {mods.map((mod) => (
                    <label key={mod}>
                      <input
                        type="checkbox"
                        checked={selectedMods.includes(mod)}
                        onChange={(e) =>
                          setSelectedMods((current) =>
                            e.target.checked
                              ? [...current, mod]
                              : current.filter((value) => value !== mod),
                          )
                        }
                      />{" "}
                      {mod}
                    </label>
                  ))}
                </div>
                <p className="text-sm">
                  {modRule === "exact"
                    ? "Leave all unchecked to require no mods."
                    : "Select at least one mod."}
                </p>
              </fieldset>
            )}
            <label className="block">
              Reward (BP)
              <input
                className={inputClass}
                type="number"
                min="1"
                step="1"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                required
              />
            </label>
          </div>
          <section
            aria-label="Bounty preview"
            className="h-fit space-y-3 rounded border p-4"
          >
            <h2 className="text-lg font-bold">Preview</h2>
            {beatmapLookupStatus === "idle" ? <p>Choose a beatmap</p> : null}
            {beatmapLookupStatus === "loading" ? (
              <p>Loading metadata..</p>
            ) : null}
            {beatmapLookupStatus === "error" ? (
              <div className="flex flex-row gap-1">
                <p>{beatmapLookupError}</p>
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => retryLookup()}
                >
                  Retry
                </button>
              </div>
            ) : null}
            {beatmapLookupStatus === "success" && beatmapMetadata ? (
              <p>
                <a
                  className="underline"
                  href={`https://osu.ppy.sh/beatmaps/${beatmapId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {beatmapMetadata.beatmapset
                    ? `${beatmapMetadata.beatmapset?.artist} - ${beatmapMetadata.beatmapset?.title} [${beatmapMetadata.version}] (${beatmapMetadata.difficulty_rating.toFixed(2)}★) ↗`
                    : beatmapId}
                </a>
              </p>
            ) : null}
            {!accountLoading && user !== null && (
              <p>Created by {user.identity.username}</p>
            )}
            <p>
              {goalType === "minimum_grade"
                ? `Minimum grade: ${gradeLabels[grade] ?? grade}`
                : `Full combo goal: at least ${combo || "—"}% combo`}
            </p>
            <p>
              {accuracy
                ? `Minimum accuracy: ${accuracy}%`
                : "No additional accuracy requirement"}
            </p>
            <p>{modSummary}</p>
            <p>Total Cost: {total_cost || "—"} BP</p>
            <p className="text-sm">Base cost: {reward || "—"} BP</p>
            <p className="text-sm">Fee cost: {fee || "—"} BP</p>
            <p className="text-sm">
              The funding fee is set to 10% of the reward, rounded up.
            </p>
            <p className="text-sm">The fee is not refundable.</p>
            {!created && result.success && balance !== null && (
              <p>Balance after creation: {balance - total_cost} BP</p>
            )}
          </section>
        </fieldset>
        {submitted && issues.length > 0 && (
          <div role="alert">
            <p>Please check the form:</p>
            <ul className="list-disc pl-6">
              {issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {insufficient && !created && (
          <p role="alert">Insufficient BP for the total cost.</p>
        )}
        {error && (
          <p role="alert">
            {error}{" "}
            <Link className="underline" href="/bounties">
              View bounties
            </Link>
          </p>
        )}
        <button
          type="submit"
          disabled={pending || created || accountLoading || user === null || insufficient}
          className="rounded bg-sky-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {pending
            ? "Creating…"
            : created
              ? "Bounty created"
              : `Create bounty${result.success ? ` · ${total_cost} BP` : ""}`}
        </button>
      </form>
    </div>
  );
}
