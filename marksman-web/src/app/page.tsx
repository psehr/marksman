import ButtonLink from "@/components/ui/ButtonLink";
import { InfoSection } from "@/components/ui/InfoSection";
import MarksmanLogo from "@/components/ui/MarksmanLogo";

export default function Home() {
  return (
    <main className="flex flex-col items-center py-12 sm:py-32 gap-16 px-4">
      <div className="flex flex-col items-center gap-2 sm:gap-8 p-6 sm:p-12 text-center border border-border rounded w-full max-w-2xl bg-surface">
        <h1>
          <MarksmanLogo size="lg" />
        </h1>
        <div className="text-foreground-muted max-w-lg text-lg sm:text-xl">
          <p>Create and complete osu! bounties.</p>
          <p>Hunt user-made challenges and earn Bounty Points.</p>
          <p>Compete against other hunters in the leaderboards.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-8 items-center">
          <div className="text-foreground-muted flex flex-col gap-2">
            <p>Start hunting now</p>
            <ButtonLink href="/bounties" size="lg" variant="accent">
              Browse bounties
            </ButtonLink>
          </div>
          <p className="text-xl font-bold text-foreground-muted">or...</p>
          <div className="text-foreground-muted flex flex-col gap-2">
            <p>Fund a new challenge</p>
            <ButtonLink href="/bounties/new" size="lg" variant="accent">
              Create a bounty
            </ButtonLink>
          </div>
        </div>
      </div>
      <InfoSection title="Disclaimer" className="w-full max-w-lg">
        <p>This project is currently in Alpha-Release.</p>
        <p>Expect game-breaking bugs and potential resets along the way.</p>
        <p>Have fun!</p>
      </InfoSection>
    </main>
  );
}
