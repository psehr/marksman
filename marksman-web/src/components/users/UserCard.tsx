import { aes_font } from "@/lib/fonts";
import { User, UserIdentity } from "@marksman/contracts";
import Image from "next/image";

export function UserCard({
  user,
  linkTo = "marksman",
}: {
  user: UserIdentity;
  linkTo?: "osu" | "marksman";
}) {
  const external = linkTo === "osu";

  return (
    <a
      href={
        external
          ? `https://osu.ppy.sh/users/${user.osuUserId}`
          : `/users/${user.id}`
      }
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={
        external
          ? `${user.username}'s osu! profile (opens in a new tab)`
          : `${user.username}'s Marksman profile`
      }
      className="flex w-full lg:flex-1 min-w-0 h-26 wrap-anywhere border border-border rounded text-xl p-2 bg-card hover:border-accent focus-visible:outline-2 focus-visible:outline-accent transition-all"
    >
      <div className="relative isolate overflow-hidden flex size-full place-content-between bg-card-darker rounded border border-border/30 shadow-[inset_0_2px_8px_rgb(0_0_0/0.7)]">
        {user.coverUrl && (
          <Image
            src={user.coverUrl}
            alt=""
            fill
            sizes="(max-width: 1023px) 100vw, 256px"
            className="-z-10 object-cover opacity-30"
          />
        )}
        <div className="px-4 gap-2 flex flex-col z-10 h-full items-center place-content-center">
          <Image
            src={`https://a.ppy.sh/${user.osuUserId}`}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-full object-cover"
          />
        </div>
        <div className="px-4 gap-2 flex flex-col z-10 h-full items-end place-content-center min-w-0 flex-1">
          <p className={`${aes_font.className} text-accent font-bold`}>
            {user.username}
          </p>
          {user.countryCode && (
            <Image
              src={`https://flagcdn.com/w40/${user.countryCode.toLowerCase()}.png`}
              alt={user.countryName ?? user.countryCode}
              title={user.countryName ?? user.countryCode}
              width={40}
              height={18}
              className="h-[18px] w-6 shrink-0 object-contain rounded-sm overflow-hidden"
            />
          )}
        </div>
      </div>
    </a>
  );
}
