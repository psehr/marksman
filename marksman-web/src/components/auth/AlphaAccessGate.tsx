"use client";

import { aes_font } from "@/lib/fonts";
import Button from "../ui/Button";
import { InfoSection } from "../ui/InfoSection";
import { AuthButton } from "./AuthButton";
import { useAuth } from "./AuthProvider";

export default function AlphaAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, error, loading, refreshUser, alphaAccess } = useAuth();

  if (alphaAccess === "allowed") return children;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      {loading ? <p>Loading...</p> : null}
      {error ? (
        <InfoSection
          title="Error"
          className="w-full max-w-sm"
          contentClassName={`p-2 flex flex-col gap-2 text-foreground-muted text-lg font-bold ${aes_font.className}`}
        >
          <span>Error fetching user access.</span>
          <Button onClick={refreshUser}>Try again</Button>
        </InfoSection>
      ) : null}
      {!error && !user && !loading ? (
        <InfoSection
          title="Authentication"
          className="w-full max-w-sm"
          contentClassName={`p-2 flex flex-col gap-2 text-foreground-muted text-lg font-bold ${aes_font.className}`}
        >
          <p className="text-accent">Welcome to Marksman's alpha-release!</p>
          <p>To access this content, start by logging in to osu!.</p>
          <AuthButton />
        </InfoSection>
      ) : null}
      {alphaAccess === "denied" ? (
        <InfoSection
          title="Alpha access denied"
          className="w-full max-w-sm"
          contentClassName={`p-2 flex flex-col gap-2 text-foreground-muted text-lg font-bold ${aes_font.className}`}
        >
          <p>
            This content is <span className="text-accent">invite-only</span>.
          </p>
          <span>Ask for an invite to access it.</span>
          <AuthButton />
        </InfoSection>
      ) : null}
      {!error && alphaAccess === "unknown" && !loading && user ? (
        <p>Unknown alpha-access status.</p>
      ) : null}
    </div>
  );
}
