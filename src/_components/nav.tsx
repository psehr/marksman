"use client";

import { BasicButton } from "./buttons";
import { useRouter } from "next/navigation";
import { signIn } from "@/auth";
import { sign_in } from "../_services/auth/sign_in";
import { sign_out } from "../_services/auth/sign_out";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import InlineUser from "./user/inline";
import { OsuUser } from "../_models/user";
import { parseUsedIdFromImageUrl } from "../_services/utils/parsers/user";

export default function Nav() {
  const router = useRouter();
  const session = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<OsuUser | undefined>();

  useEffect(() => {
    setIsAuthenticated(session.status == "authenticated");
    session.status == "authenticated"
      ? setCurrentUser({
          id: parseInt(parseUsedIdFromImageUrl(session.data?.user?.image!)),
          name: session.data.user?.name!,
          image: session.data.user?.image!,
          country_code: "FR",
        })
      : setCurrentUser(undefined);
  }, [session.status]);

  return (
    <div className="z-10 fixed flex flex-row w-screen h-24 place-content-center items-center bg-slate-800/70 backdrop-blur-sm">
      <div className="w-[10%] absolute z-10 left-8 h-full flex flex-row space-x-4 place-content-center items-center">
        <BasicButton
          onClick={() => {
            router.push("/");
          }}
        >
          Marksman 🎯
        </BasicButton>
      </div>
      <div className="w-full h-full relative flex flex-row space-x-4 place-content-center items-center">
        <BasicButton
          onClick={() => {
            router.push("/");
          }}
        >
          Home
        </BasicButton>
        <BasicButton
          onClick={() => {
            router.push("/bounties");
          }}
        >
          Bounties
        </BasicButton>
        <BasicButton
          onClick={() => {
            router.push("/lb");
          }}
        >
          Rankings
        </BasicButton>
      </div>
      <div className="w-fit absolute z-10 right-8 h-full flex flex-row space-x-4 place-content-center items-center">
        {isAuthenticated && currentUser ? (
          <div className="flex flex-row space-x-4">
            <div
              className="p-1 px-4 w-fit h-fit bg-slate-700 rounded-xl cursor-pointer"
              onClick={() => {
                router.push("/user/" + currentUser.id);
              }}
            >
              <InlineUser user={currentUser} notClickable />
            </div>
            <BasicButton onClick={() => {}}>Level 112</BasicButton>
            <BasicButton onClick={sign_out} color="red">
              Log out
            </BasicButton>
          </div>
        ) : (
          <BasicButton onClick={sign_in}>Log in</BasicButton>
        )}
      </div>
    </div>
  );
}
