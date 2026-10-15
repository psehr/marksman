"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import Link from "next/link";

export function AuthButton() {
  const { user, loading, error, refreshUser } = useAuth();

  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function logout() {
    setLogoutError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      void refreshUser();
    } catch {
      setLogoutError("Could not log out. Please try again.");
    }
  }

  if (loading) {
    return <p>Loading..</p>;
  }

  if (error) {
    return <p>Error</p>;
  }

  if (!user) {
    return (
      <Link
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/osu`}
        className="rounded bg-sky-700 px-4 py-2 text-white h-fit"
      >
        Log in with osu!
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          logout();
        }}
        className="rounded bg-red-700/50 px-4 py-2 text-white h-fit cursor-pointer"
      >
        Log out
      </button>
      {logoutError && <p role="alert">{logoutError}</p>}
    </>
  );
}
