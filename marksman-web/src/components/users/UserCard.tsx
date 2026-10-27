import { User } from "@marksman/contracts";
import Link from "next/link";

export function UserCard({ user }: { user: User }) {
  return (
    <div className="size-fit max-w-full wrap-anywhere px-4 p-2 border border-border rounded bg-background text-xl">
      <Link
        className="font-bold underline underline-offset-2"
        href={`https://osu.ppy.sh/users/${user.identity.osuUserId}`}
      >
        {user.identity.username}
      </Link>
      <p>Balance: {user.stats.bpBalance} BP</p>
    </div>
  );
}
