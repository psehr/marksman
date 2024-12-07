"use client";

import { BasicButton } from "./buttons";
import { useRouter } from "next/navigation";

export default function Nav() {
  const router = useRouter();
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
        <BasicButton
          onClick={() => {
            router.push("/login");
          }}
        >
          Log in
        </BasicButton>
        <BasicButton
          onClick={() => {
            router.push("/login");
          }}
        >
          Level 112
        </BasicButton>
        <BasicButton
          onClick={() => {
            router.push("/login");
          }}
        >
          🪙13,670
        </BasicButton>
      </div>
    </div>
  );
}
