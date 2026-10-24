export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Transport only. Callers validate successful JSON against their contract. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = body && typeof body === "object" ? body : {};
    throw new ApiError(
      "error" in error && typeof error.error === "string"
        ? error.error
        : "Request failed. Please try again.",
      response.status,
      "code" in error && typeof error.code === "string" ? error.code : undefined,
    );
  }
  return response.json();
}
