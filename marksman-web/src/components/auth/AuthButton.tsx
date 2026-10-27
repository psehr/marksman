"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import Button from "../ui/Button";
import ButtonLink from "../ui/ButtonLink";

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
      <ButtonLink
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/osu`}
        variant="accent"
      >
        Log in with osu!
      </ButtonLink>
    );
  }

  return (
    <>
      <Button variant="danger" onClick={() => logout()}>
        Log out
      </Button>
      {logoutError && <p role="alert">{logoutError}</p>}
    </>
  );
}
