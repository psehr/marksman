"use client";

import { AboutLink } from "@/components/about/AboutLink";
import { AboutSection } from "@/components/about/AboutSection";
import { AccentText } from "@/components/about/AccentText";
import { AuthButton } from "@/components/auth/AuthButton";
import { useAuth } from "@/components/auth/AuthProvider";
import ButtonLink from "@/components/ui/ButtonLink";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function AboutPage() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge>About - Marksman</PageHeaderBadge>
      <AboutSection id="core-concept" title="Core Concept">
        <p>
          <AccentText>Marksman</AccentText> is an osu! project with the goal of{" "}
          <AccentText>creating fun interactions between players</AccentText> in
          the community.
        </p>
        <p>
          At its core it’s intended to be a casual way of{" "}
          <AccentText>finding new goals</AccentText> to complete or to{" "}
          <AccentText>challenge other players</AccentText> in the community with
          custom-made goals.
        </p>
        <p>
          It is designed as a fairly automatic system, except for the bounty
          creation process.
        </p>
        <p>
          At the moment, only osu!standard is supported, but other official
          modes support is planned in the future.
        </p>
      </AboutSection>
      <AboutSection id="how-to-play" title="How to play?">
        <p>To start playing, you first have to log in to your osu! account.</p>
        {!user ? <AuthButton /> : null}
        <p>
          Once you’re logged in, navigate to the{" "}
          <AboutLink url="/bounties">bounties page</AboutLink> where you’ll find
          a <AccentText>browsable list</AccentText> of the{" "}
          <AccentText>current ongoing bounties</AccentText> created by other
          users, as well as the <AccentText>Bounty Creation Tool</AccentText>{" "}
          button.
        </p>
      </AboutSection>
      <AboutSection
        id="hunting-your-first-bounty"
        title="Hunting your first bounty"
      >
        <p>
          When you find a bounty that you’d like to play in the bounty board,{" "}
          <AccentText>click on its card</AccentText> to open the bounty details.
        </p>
        <p>
          There you’ll see a{" "}
          <AccentText>breakdown of the requirements</AccentText> and other
          useful information about this specific bounty.
        </p>
        <p className="text-danger font-bold">
          Before playing it, click on the "Start Hunt" button.
        </p>
        <p>
          If you <AccentText>currently have an open slot</AccentText>, starting
          the hunt will <AccentText>automatically track</AccentText> all
          subsequent submitted scores set on this map by you. For more details
          about hunting <AboutLink url="/about/hunting">click here</AboutLink>.
        </p>
        <p>
          When a <AccentText>valid attempt is found</AccentText> and after a{" "}
          <AccentText>30-second settlement window</AccentText>, Marksman awards
          the player with the earliest valid attempt.
        </p>
      </AboutSection>
      <AboutSection title="Other about pages" id="about-pages">
        <p>
          These pages detail how the Marksman system works{" "}
          <AccentText>more precisely</AccentText>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ButtonLink href="/about/bounties" variant="outline" size="lg">
            About - Bounties
          </ButtonLink>
          <ButtonLink href="/about/bounty-creation" variant="outline" size="lg">
            About - Bounty Creation
          </ButtonLink>
          <ButtonLink href="/about/hunting" variant="outline" size="lg">
            About - Hunting
          </ButtonLink>
          <ButtonLink href="/about/economy" variant="outline" size="lg">
            About - Economy
          </ButtonLink>
        </div>
      </AboutSection>
    </div>
  );
}
