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
import { parseUserIdFromImageUrl } from "../_services/utils/parsers/user";
import { RxHamburgerMenu, RxCross1 } from "react-icons/rx";

export default function Nav() {
  const router = useRouter();
  const session = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<OsuUser | undefined>();

  const [showBurger, setShowBurger] = useState(false);

  useEffect(() => {
    setIsAuthenticated(session.status == "authenticated");
    session.status == "authenticated"
      ? setCurrentUser({
          id: parseInt(parseUserIdFromImageUrl(session.data?.user?.image!)),
          name: session.data.user?.name!,
          image: session.data.user?.image!,
          country_code: "FR",
        })
      : setCurrentUser(undefined);
  }, [session.status]);

  return (
    <div className="z-10 fixed flex flex-row w-screen h-24 place-content-center items-center bg-slate-800/70 backdrop-blur-sm">
      <div className="w-fit absolute z-10 left-8 h-full flex flex-row space-x-4 place-content-center items-center">
        <BasicButton
          onClick={() => {
            router.push("/");
          }}
        >
          Marksman 🎯
        </BasicButton>
      </div>
      <div className="w-full h-full relative hidden md:flex flex-row space-x-4 place-content-center items-center">
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
      <div className="w-fit absolute z-10 right-8 h-full hidden md:flex flex-row space-x-4 place-content-center items-center">
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
      <div
        className="w-fit h-full absolute flex md:hidden z-10 right-8 place-content-center items-center cursor-pointer"
        onClick={() => setShowBurger(true)}
      >
        <RxHamburgerMenu size={24} />
      </div>
      {showBurger ? (
        <div className="absolute top-0 flex flex-col w-full h-fit z-30 bg-slate-800/90 backdrop-blur-sm">
          <div className="relative flex flex-col space-y-4 w-full h-full items-center place-content-start px-8 p-4 pb-12">
            <div
              className="absolute top-4 right-4 cursor-pointer"
              onClick={() => setShowBurger(false)}
            >
              <RxCross1 />
            </div>
            <BasicButton
              onClick={() => {
                setShowBurger(false);
                router.push("/");
              }}
            >
              Marksman 🎯
            </BasicButton>
            <BasicButton
              onClick={() => {
                setShowBurger(false);

                router.push("/bounties");
              }}
            >
              Bounties
            </BasicButton>
            <BasicButton
              onClick={() => {
                setShowBurger(false);

                router.push("/lb");
              }}
            >
              Rankings
            </BasicButton>
            <hr className="w-1/2 opacity-25" />
            {isAuthenticated && currentUser ? (
              <div className="flex flex-col items-center space-y-4">
                <div
                  className="p-1 px-4 w-fit h-fit bg-slate-700 rounded-xl cursor-pointer"
                  onClick={() => {
                    setShowBurger(false);

                    router.push("/user/" + currentUser.id);
                  }}
                >
                  <InlineUser user={currentUser} notClickable />
                </div>
                <BasicButton onClick={sign_out} color="red">
                  Log out
                </BasicButton>
              </div>
            ) : (
              <BasicButton onClick={sign_in}>Log in</BasicButton>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
