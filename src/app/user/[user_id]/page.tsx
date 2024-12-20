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
      <div className="flex flex-col w-fit sm:w-[45%] min-h-full h-full  place-content-start items-start p-8 mt-8 rounded-xl space-y-4">
        {osuUserData ? (
          <div className="flex flex-col w-full h-full place-content-start items-center space-y-4">
            <div className="flex flex-col md:flex-row w-full h-fit place-content-evenly items-center space-y-4 md:space-y-0 md:space-x-4">
              <div className="relative flex flex-row  w-full h-full md:w-2/3 bg-slate-700 rounded-xl shadow-lg">
                <div className="absolute flex w-full h-full rounded-xl overflow-hidden">
                  <Image src={osuUserData.cover_url} alt="cover" fill />
                </div>
                <div className="absolute z-0 flex w-full h-full  bg-black/50 backdrop-blur-sm rounded-xl"></div>
                <div className="flex flex-row w-1/2 p-6 h-full place-content-center items-center z-0">
                  <div className="p-2 relative w-full h-fit flex overflow-hidden">
                    <Image
                      className="rounded-3xl shadow-lg"
                      src={osuUserData.avatar_url}
                      alt="profile picture"
                      width={200}
                      height={200}
                    />
                  </div>
                </div>
                <div className="relative flex flex-row place-content-center items-center w-1/2 h-full z-0">
                  <div className="hidden md:flex absolute top-1 right-2 text-xs md:text-sm">
                    <p>🪙 4.3M</p>
                  </div>
                  <div className="flex flex-col space-y-2  w-full place-content-center items-center">
                    <div className="flex flex-row space-x-2 place-content-center items-center">
                      <p className="text-md md:text-2xl">
                        {osuUserData.username}
                      </p>
                      <div className="rounded-sm overflow-hidden w-8 h-fit">
                        {Flag ? <Flag /> : null}
                      </div>
                    </div>
                    <p className="text-blue-400 text-sm">
                      {userData?.xp_rank_tier.title}
                    </p>
                    <div className="rounded-full border-2 border-purple-400 bg-purple-400/10 w-fit h-fit p-0.5  px-4 place-content-center items-center">
                      <p className="text-center text-sm md:text-2xl">235</p>
                    </div>
                  </div>
                  <div className="hidden md:flex absolute bottom-1 right-2 text-xs md:text-sm">
                    <p>Joined 12/12/24</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-row md:flex-col w-full h-fit md:w-1/3 md:h-full bg-slate-700 p-2 px-4 rounded-xl place-content-evenly shadow-lg space-x-2 md:space-x-0 md:space-y-4">
                <div className="relative flex flex-col space-y-1">
                  <p className="text-sm md:text-md">Hunter</p>
                  <p className="text-xs md:text-sm">Lvl 112 (50%)</p>
                  <div className="relative w-full h-2 bg-slate-400 rounded-full overflow-hidden">
                    <div className="relative w-1/2 h-2 bg-red-400 rounded-full"></div>
                  </div>
                  <p className="hidden md:flex absolute right-0 top-0 text-gray-400">
                    #161
                  </p>
                </div>
                <div className="relative flex flex-col space-y-1">
                  <p className="text-sm md:text-md">Initiator</p>
                  <p className="text-xs md:text-sm">Lvl 96 (30%)</p>
                  <div className="relative w-full h-2 bg-slate-400 rounded-full overflow-hidden">
                    <div className="relative w-1/3 h-2 bg-green-400 rounded-full"></div>
                  </div>
                  <p className="hidden md:flex absolute right-0 top-0 text-gray-400">
                    #1,311
                  </p>
                </div>
                <div className="relative flex flex-col space-y-1">
                  <p className="text-sm md:text-md">Writer</p>
                  <p className="text-xs md:text-sm">Lvl 27 (60%)</p>
                  <div className="relative w-full h-2 bg-slate-400 rounded-full overflow-hidden">
                    <div className="relative w-2/3 h-2 bg-blue-400 rounded-full"></div>
                  </div>
                  <p className="hidden md:flex absolute right-0 top-0 text-gray-400">
                    #19
                  </p>
                </div>
              </div>
            </div>
            <div className="flex bg-slate-700 w-full h-2/3 rounded-xl place-content-center items-center flex-col">
              <p className="text-gray-500 text-2xl text-center">
                Completed bounties
              </p>
              <p className="text-gray-500 text-2xl text-center">/////////</p>
              <p className="text-gray-500 text-2xl text-center">
                Created bounties
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
