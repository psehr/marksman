"use client";

import React, { MouseEventHandler } from "react";

export type ButtonColor = "default" | "red" | "green" | "blue" | "yellow";

export function BasicButton({
  children,
  onClick,
  color,
  small,
  large,
}: {
  children: React.ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  color?: ButtonColor;
  small?: boolean;
  large?: boolean;
}) {
  !color ? (color = "default") : null;

  let bg_color = "";

  switch (color) {
    case "default":
      bg_color = "bg-slate-700 hover:bg-slate-600";
      break;
    case "red":
      bg_color = "bg-red-800 hover:bg-red-700";
      break;
    case "green":
      bg_color = "bg-green-800 hover:bg-green-700";
      break;
    case "blue":
      bg_color = "bg-blue-800 hover:bg-blue-700";
      break;
    case "yellow":
      bg_color = "bg-yellow-800 hover:bg-yellow-700";
      break;
  }

  return (
    <button
      className={`flex flex-row items-center place-content-center space-x-2 text-center shadow-lg ${
        small ? "" : "min-w-24"
      } ${
        large ? "w-full" : "w-fit"
      } h-fit ${bg_color} transition-all duration-[25ms] p-1 px-4 rounded-xl`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
