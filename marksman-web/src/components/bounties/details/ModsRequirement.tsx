import type { ExtendedBounty } from "@marksman/contracts";
import { aes_font, base_font } from "@/lib/fonts";
import ModIcon from "@/components/osu/ModIcon";

export default function ModsRequirement({ bounty }: { bounty: ExtendedBounty }) {
  const { required, forbidden, allowOtherMods } = bounty.goal.modRequirement;

  if (allowOtherMods && required.length === 0 && forbidden.length === 0) {
    return (
      <p className={`${aes_font.className} font-bold text-center`}>
        Any supported mods are allowed
      </p>
    );
  }

  return (
    <div className={`flex flex-col gap-3 text-center ${aes_font.className} font-bold`}>
      {!allowOtherMods ? (
        <div className="flex min-w-0 flex-col items-center gap-2">
          <h3 className="text-accent">Exact mods</h3>
          <div className="flex max-w-full flex-wrap justify-center gap-1">
            {required.length ? (
              required.map((mod) => <ModIcon mod={mod} key={mod} size="md" />)
            ) : (
              <ModIcon mod="NM" size="md" />
            )}
          </div>
          <p className={`text-xs text-foreground-muted font-normal ${base_font.className}`}>
            Additional mods are forbidden.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex min-w-0 flex-col items-center gap-2">
              <h3 className="text-accent">Required</h3>
              <div className="flex max-w-full flex-wrap justify-center gap-1">
                {required.length ? (
                  required.map((mod) => <ModIcon mod={mod} key={mod} size="md" />)
                ) : (
                  <p className="text-sm text-foreground-muted">None</p>
                )}
              </div>
            </div>
            <div className="flex min-w-0 flex-col items-center gap-2">
              <h3 className="text-accent">Forbidden</h3>
              <div className="flex max-w-full flex-wrap justify-center gap-1">
                {forbidden.length ? (
                  forbidden.map((mod) => <ModIcon mod={mod} key={mod} size="md" crossed />)
                ) : (
                  <p className="text-sm text-foreground-muted">None</p>
                )}
              </div>
            </div>
          </div>
          <p className={`text-xs text-foreground-muted font-normal ${base_font.className}`}>
            Additional supported mods are allowed.
          </p>
        </>
      )}
    </div>
  );
}
