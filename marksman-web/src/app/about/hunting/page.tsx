import { AboutLink } from "@/components/about/AboutLink";
import { AboutSection } from "@/components/about/AboutSection";
import { AboutSubSection } from "@/components/about/AboutSubSection";
import { AccentText } from "@/components/about/AccentText";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function AboutHuntingPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge icon="hunt">About - Hunting</PageHeaderBadge>
      <AboutSection title="What is hunting?" id="what-is-hunting">
        <p>
          In Marksman,{" "}
          <AccentText>
            hunting is how you attempt to complete another player's bounty
          </AccentText>
          , you cannot hunt your own bounties.
        </p>
        <p>
          A bounty hunt is initiated by clicking on the{" "}
          <AccentText>“Start Hunt” button</AccentText> in the bounty details
          page, once the hunt starts and as long as it is still active,{" "}
          <AccentText>Marksman will track all your osu! scores</AccentText> for
          that difficulty.
        </p>
        <p>
          Each player has <AccentText>two hunting slots</AccentText>, this means
          that you can only hunt{" "}
          <AccentText>two different bounties at the same time</AccentText>.
        </p>
        <p>
          From the bounty details page, you can click on the{" "}
          <AccentText>“Stop Hunt” button</AccentText> to stop tracking new
          scores for this bounty and{" "}
          <AccentText>free up a hunting slot</AccentText>.
        </p>
        <p>
          Hunting is <AccentText>indefinite</AccentText>, as long as it’s active
          you can try to complete the bounty.
        </p>
        <p>
          Hunting doesn’t reserve a bounty,{" "}
          <AccentText>other players can hunt it at the same time</AccentText>.
        </p>
      </AboutSection>
      <AboutSection title="How does completion work?" id="bounty-completion">
        <p>
          To qualify for completion, a valid score must be{" "}
          <AccentText>submitted while the hunt is active</AccentText> and
          satisfy every other{" "}
          <AboutLink url="/about/bounties#what-are-bounties">
            bounty goal requirement
          </AboutLink>
          .
        </p>
        <p>
          When a <AccentText>qualifying score</AccentText> is found, a{" "}
          <AccentText>30-second settlement</AccentText> period is started,
          giving Marksman time to discover other potential qualifying scores
          that would arrive later.
        </p>
        <p>
          The <AccentText>earliest submitted score wins</AccentText>, even if
          another score was discovered first.
        </p>
        <p>Verification delays can make settlement take longer.</p>
        <p>
          Once <AccentText>the result is confirmed</AccentText>, the bounty
          closes and its reward is added to the winner’s{" "}
          <AboutLink url="/about/economy#bounty-points">BP balance</AboutLink>.
        </p>
      </AboutSection>
      <AboutSection title="What is a valid score?" id="what-is-valid-score">
        <p>
          In Marksman, a valid score is a submitted{" "}
          <AccentText>osu! score</AccentText> that can, after settlement,
          successfully{" "}
          <AboutLink url="/about/hunting#bounty-completion">
            complete a bounty
          </AboutLink>
          .
        </p>
        <p>To be valid, it must respect the following:</p>
        <AboutSubSection index="I." id="player-is-claimant">
          The score must{" "}
          <AccentText>
            belong to the osu! account linked to the hunter
          </AccentText>
          .
        </AboutSubSection>
        <AboutSubSection index="II." id="player-is-not-owner">
          The player <AccentText>must not be the bounty’s creator</AccentText>.
        </AboutSubSection>
        <AboutSubSection index="III." id="bounty-is-open">
          The bounty <AccentText>must still be open</AccentText>.
        </AboutSubSection>
        <AboutSubSection index="IV." id="valid-timestamp">
          The score must be{" "}
          <AccentText>submitted after the bounty was created</AccentText> and
          while the <AccentText>player’s hunt is active</AccentText>.
        </AboutSubSection>
        <AboutSubSection index="V." id="valid-beatmap">
          The score must be on the{" "}
          <AccentText>exact beatmap difficulty</AccentText> specified by the
          bounty.
        </AboutSubSection>
        <AboutSubSection index="VI." id="valid-ruleset">
          The score must use the <AccentText>osu!standard</AccentText> ruleset.
        </AboutSubSection>
        <AboutSubSection index="VII." id="score-passed">
          The score must be a <AccentText>passed play</AccentText>.
        </AboutSubSection>
        <AboutSubSection index="VIII." id="acc-goal">
          The accuracy must{" "}
          <AccentText>meet or exceed the bounty’s minimum accuracy</AccentText>,
          if one is specified.
        </AboutSubSection>
        <AboutSubSection index="IX." id="mod-requirement">
          The score must satisfy the bounty’s{" "}
          <AccentText>mod requirement</AccentText>, see{" "}
          <AboutLink url="/about/bounties#mod-rules">mod rules</AboutLink>.
        </AboutSubSection>
        <AboutSubSection index="X." id="supported-mods">
          Only <AccentText>supported mods may be used</AccentText> (or no mods,
          if allowed). See{" "}
          <AboutLink url="/about/bounties#supported-mods">
            supported mods.
          </AboutLink>
        </AboutSubSection>
        <AboutSubSection index="XI." id="custom-mods">
          Mods must use their default settings:{" "}
          <AccentText>customization is not allowed</AccentText>.
        </AboutSubSection>
        <AboutSubSection index="XII." id="grade-requirement">
          For a grade requirement, the achieved grade must{" "}
          <AccentText>meet or exceed the selected grade</AccentText>. See{" "}
          <AboutLink url="/about/bounties#grade-requirement">
            grade requirement
          </AboutLink>
          .
        </AboutSubSection>
        <AboutSubSection index="XIII." id="fc-requirement">
          For a full-combo requirement, see{" "}
          <AboutLink url="/about/bounties#fc-ruling">FC ruling</AboutLink>.
        </AboutSubSection>
        <p>
          When <AccentText>all</AccentText> these conditions are successfully
          met, Marksman initiates the settlement period and, if suitable, closes
          the bounty before awarding the winner. See{" "}
          <AboutLink url="/about/hunting#bounty-completion">
            completion
          </AboutLink>
          .
        </p>
      </AboutSection>
    </div>
  );
}
