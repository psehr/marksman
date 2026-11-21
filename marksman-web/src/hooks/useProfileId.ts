import { useEffect, useState } from "react";
import { userIdentitySchema } from "@marksman/contracts";
import { getUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";

type Resolution =
  | { identifier: string; status: "complete"; id: string }
  | { identifier: string; status: "notFound" | "errored" };

export function useProfileId(identifier: string) {
  const parsed = userIdentitySchema.shape.id.safeParse(identifier);
  const uuid = parsed.success ? parsed.data : undefined;
  const [resolution, setResolution] = useState<Resolution>();

  useEffect(() => {
    if (uuid) return;

    let ignore = false;

    async function resolve() {
      try {
        const user = await getUser(identifier);
        if (!ignore) {
          setResolution({
            identifier,
            status: "complete",
            id: user.identity.id,
          });
        }
      } catch (error) {
        if (!ignore) {
          setResolution({
            identifier,
            status:
              error instanceof ApiError &&
              (error.status === 404 || error.status === 400)
                ? "notFound"
                : "errored",
          });
        }
      }
    }

    void resolve();

    return () => {
      ignore = true;
    };
  }, [identifier, uuid]);

  if (uuid) return { status: "complete" as const, id: uuid };

  if (resolution?.identifier === identifier) return resolution;

  return { status: "loading" as const };
}
