import { OsuUser } from "@models/user";
import Image from "next/image";

export default function InlineUser({
  user,
  noAvatar,
  notClickable,
}: {
  user: OsuUser;
  noAvatar?: boolean;
  notClickable?: boolean;
}) {
  return (
    <div
      className="w-fit h-full flex flex-row space-x-1 items-center cursor-pointer text-nowrap"
      onClick={() => {
        !notClickable
          ? window.open(`https://osu.ppy.sh/users/${user.name}`)
          : null;
      }}
    >
      <p className="font-semibold">{user.name}</p>
      {noAvatar ? null : (
        <div className="hidden sm:flex sm:size-4 rounded-full overflow-hidden">
          <Image
            src={user.image}
            width={128}
            height={128}
            alt="User osu! Avatar"
          />
        </div>
      )}
    </div>
  );
}
