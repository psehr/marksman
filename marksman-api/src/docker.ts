import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
// `src` in development and `dist` in production are both one level below the
// directory that contains compose.yaml.
const composeDirectory = resolve(__dirname, "..");

type ComposeService = {
  State?: string;
  Health?: string;
};

export type DatabaseContainerStatus = {
  state: string;
  health: string | null;
};

export async function getDatabaseContainerStatus(): Promise<DatabaseContainerStatus> {
  const { stdout } = await execFileAsync(
    "docker",
    ["compose", "ps", "--all", "postgres", "--format", "json"],
    { cwd: composeDirectory },
  );

  if (!stdout.trim()) {
    return { state: "not-found", health: null };
  }

  const parsed = JSON.parse(stdout) as ComposeService | ComposeService[];
  const service = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!service) {
    return { state: "not-found", health: null };
  }

  return {
    state: service.State?.toLowerCase() ?? "unknown",
    health: service.Health?.toLowerCase() ?? null,
  };
}
