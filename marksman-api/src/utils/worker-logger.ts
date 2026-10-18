type WorkerLogContext = Record<string, unknown>;

function formatDetails(context: WorkerLogContext) {
  return Object.entries(context)
    .map(([key, value]) => `${singleLine(key)}=${formatValue(value)}`)
    .join(" ");
}

function singleLine(text: string): string {
  return text.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

function formatValue(value: unknown): string {
  try {
    const printable = value instanceof Error ? value.message : value;

    if (typeof printable === "bigint") {
      return printable.toString();
    }

    return JSON.stringify(printable) ?? String(printable);
  } catch {
    return '"[unserializable]"';
  }
}

export function createWorkerLogger(workerName: string) {
  return {
    info(eventName: string, context: WorkerLogContext = {}) {
      const now = new Date();

      console.info(
        singleLine(
          `${now.toISOString()} [INFO] [${workerName}] ${eventName} ${formatDetails(context)}`,
        ),
      );
    },
    warn(eventName: string, context: WorkerLogContext = {}) {
      const now = new Date();

      console.warn(
        singleLine(
          `${now.toISOString()} [WARN] [${workerName}] ${eventName} ${formatDetails(context)}`,
        ),
      );
    },
    error(eventName: string, context: WorkerLogContext = {}) {
      const now = new Date();

      console.error(
        singleLine(
          `${now.toISOString()} [ERROR] [${workerName}] ${eventName} ${formatDetails(context)}`,
        ),
      );
    },
  };
}
