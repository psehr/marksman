"use client";

import { MarksmanUser } from "@/src/_models/user";
import { fetchUser } from "@/src/_services/database/users";
import { useEffect, useState } from "react";
import Image from "next/image";
import * as Flags from "country-flag-icons/react/3x2";
import { fetchOsuUser } from "@/src/_services/osu_api/user";
import { UsersDetailsResponse } from "osu-api-extended/dist/types/v2/users_details";

export default function UserProfile({
  params,
}: {
  params: Promise<{ user_id: string }>;
}) {
  const [userData, setUserData] = useState<MarksmanUser>();
  const [osuUserData, setOsuUserData] = useState<UsersDetailsResponse>();

  useEffect(() => {
    params.then((user_id) => {
      if (user_id) {
        fetchUser(user_id.user_id).then((r) => {
          setUserData(r);
        });
        fetchOsuUser(user_id.user_id).then((r) => {
          setOsuUserData(r);
        });
      }
    });
  }, []);

  let Flag =
    Flags[osuUserData?.country_code.toUpperCase() as keyof typeof Flags];

  return (
    <div className="flex flex-col sm:flex-row w-full h-full place-content-center items-start space-x-4 font-extrabold overflow-y-auto">
      <div className="flex flex-col w-fit sm:w-[45%] min-h-full h-full bg-slate-800/70 place-content-start items-start p-8 mt-8 rounded-xl space-y-4 shadow-lg">
        {osuUserData ? (
          <div className="flex flex-col w-full h-full place-content-start items-center space-y-4">
            <div className="flex flex-row w-full h-1/4 place-content-evenly space-x-4">
              <div className="relative flex flex-row w-2/3 h-full bg-slate-700 rounded-xl shadow-lg">
                <div className="absolute flex w-full h-full rounded-xl overflow-hidden">
                  <Image src={osuUserData.cover_url} alt="cover" fill />
                </div>
                <div className="absolute flex w-full h-full  bg-black/50 backdrop-blur-sm rounded-xl"></div>
                <div className="flex flex-row w-1/2 p-6 h-full place-content-center items-center z-10">
                  <div className="relative w-full h-fit flex overflow-hidden rounded-3xl shadow-lg">
                    <Image
                      src={osuUserData.avatar_url}
                      alt="profile picture"
                      width={200}
                      height={200}
                    />
                  </div>
                </div>
                <div className="relative flex flex-row place-content-center items-center w-2/3 h-full z-10">
                  <div className="absolute top-2 right-2 text-sm">
                    <p>🪙 4.3M</p>
                  </div>
                  <div className="flex flex-col space-y-2 w-full place-content-center items-center">
                    <div className="flex flex-row space-x-2 place-content-center items-center">
                      <p className="text-2xl">{osuUserData.username}</p>
                      <div className="rounded-sm overflow-hidden w-8 h-fit">
                        {Flag ? <Flag /> : null}
                      </div>
                    </div>
                    <p className="text-blue-400">
                      {userData?.xp_rank_tier.title}
                    </p>
                    <div className="rounded-full border-2 border-purple-400 bg-purple-400/10 w-24 h-12 place-content-center items-center">
                      <p className="text-center text-2xl">235</p>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 text-sm">
                    <p>Joined 12/12/24</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col w-1/3 h-full bg-slate-700 p-2 px-4 rounded-xl place-content-center shadow-lg space-y-4">
                <div className="relative flex flex-col">
                  <p>Hunter</p>
                  <p className="text-sm">Level 112 (50%)</p>
                  <div className="relative w-full h-2 bg-slate-400 rounded-full overflow-hidden">
                    <div className="relative w-1/2 h-2 bg-red-400 rounded-full"></div>
                  </div>
                  <p className="absolute right-0 top-0 text-gray-400">#161</p>
                </div>
                <div className="relative flex flex-col">
                  <p>Initiator</p>
                  <p className="text-sm">Level 96 (30%)</p>
                  <div className="relative w-full h-2 bg-slate-400 rounded-full overflow-hidden">
                    <div className="relative w-1/3 h-2 bg-green-400 rounded-full"></div>
                  </div>
                  <p className="absolute right-0 top-0 text-gray-400">#1,311</p>
                </div>
                <div className="relative flex flex-col">
                  <p>Writer</p>
                  <p className="text-sm">Level 27 (60%)</p>
                  <div className="relative w-full h-2 bg-slate-400 rounded-full overflow-hidden">
                    <div className="relative w-2/3 h-2 bg-blue-400 rounded-full"></div>
                  </div>
                  <p className="absolute right-0 top-0 text-gray-400">#19</p>
                </div>
              </div>
            </div>
            <div className="flex bg-slate-700 w-full h-2/3 rounded-xl place-content-center items-center">
              <p className="text-gray-500 text-3xl">
                Completed bounties / Created bounties here
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
