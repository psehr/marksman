import { aes_font } from "@/lib/fonts";
import { User } from "@marksman/contracts";

export function UserCard({ user }: { user: User }) {
  return (
    <div className="flex w-3xs max-w-sm min-w-0 h-32 wrap-anywhere p-2 border border-border rounded bg-card text-xl">
      <div className="flex place-content-center items-center bg-card-darker size-full border border-border/30 rounded shadow-[inset_0_2px_8px_rgb(0_0_0/0.7)]">
        <span
          className={`text-accent ${aes_font.className} font-bold text-2xl`}
        >
          {user.identity.username}
        </span>
      </div>
    </div>
  );
}
