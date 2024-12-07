import { OsuUser } from "@models/user";
import Image from "next/image";

export default function InlineUser({
  user,
  noAvatar,
}: {
  user: OsuUser;
  noAvatar?: boolean;
}) {
  return (
    <div
      className="w-fit h-full flex flex-row space-x-1 items-center cursor-pointer text-nowrap"
      onClick={() => {
        window.open(`https://osu.ppy.sh/users/${user.id}`);
      }}
    >
      <p className="font-semibold">{user.name}</p>
      {noAvatar ? null : (
        <div className="hidden sm:flex sm:size-4 rounded-full overflow-hidden">
          <Image
            src={user.image}
            width={128}
            height={128}
            alt="Creator Avatar"
          />
        </div>
      )}
    </div>
  );
}
