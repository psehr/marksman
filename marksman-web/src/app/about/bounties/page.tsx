import PageHeaderBadge from "@/components/ui/PageHeaderBadge";
import { AboutLink } from "@/components/about/AboutLink";
import { AboutSubSection } from "@/components/about/AboutSubSection";
import { AboutSection } from "@/components/about/AboutSection";
import { AccentText } from "@/components/about/AccentText";
import { aes_font } from "@/lib/fonts";
import GradeIcon from "@/components/osu/GradeIcon";
import ModIcon from "@/components/osu/ModIcon";
import BountyTierBadge from "@/components/bounties/BountyTierBadge";
import BPIcon from "@/components/economy/BPIcon";

export default function AboutBountiesPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge>About - Bounties</PageHeaderBadge>
      <AboutSection id="what-are-bounties" title="What are bounties?">
        <p>
          Bounties are <AccentText>user-made challenges</AccentText> that can be
          completed by other players using the{" "}
          <AboutLink url="/about/hunting">hunting system</AboutLink>, they can
          be created by any player using the{" "}
          <AccentText>Bounty Creation Tool</AccentText>.
        </p>
        <p>
          An open bounty <AccentText>can be cancelled</AccentText> by its
          creator at any time, its{" "}
          <AboutLink url="/about/bounties#bounty-status">status</AboutLink> then
          changes and it can no longer be completed afterwards.
        </p>
        <p>
          The five <AccentText>main characteristics</AccentText> of bounties are
          the following:
        </p>
        <AboutSubSection id="reward" index="I.">
          <p>
            The bounty <AccentText>reward</AccentText> is a positive integer
            amount of{" "}
            <AboutLink url="/about/economy#bounty-points">
              Bounty Points (BP)
            </AboutLink>{" "}
            chosen by the bounty creator.
          </p>
          <p>
            It is awarded to the{" "}
            <AccentText>
              first player successfully completing the bounty
            </AccentText>
            .
          </p>
          <p>
            Different bounty reward ranges are subdivided in{" "}
            <AccentText>reward tiers</AccentText>, allowing for easier
            recognition of the bounty’s reward value.
          </p>
        </AboutSubSection>
        <AboutSubSection id="beatmap" index="II.">
          <p>
            The goal <AccentText>beatmap</AccentText> is a specific{" "}
            <AccentText>osu!standard</AccentText> difficulty of a{" "}
            <AccentText>Ranked, Loved or Approved</AccentText> beatmapset, it is
            chosen by the bounty creator.
          </p>
          <p>
            To successfully complete the bounty, the{" "}
            <AboutLink url="/about/hunting#what-is-valid-score">
              valid score
            </AboutLink>{" "}
            must be set on <AccentText>this specific beatmap</AccentText>.
          </p>
        </AboutSubSection>
        <AboutSubSection id="goal-types" index="III.">
          <p>
            The goal <AccentText>types</AccentText> are of two different
            categories, one must be chosen by the bounty creator, they are as
            follows:
          </p>
          <AboutSubSection id="full-combo" index="1.">
            <p>
              The <AccentText>full-combo</AccentText> type requires the{" "}
              <AboutLink url="/about/hunting#what-is-valid-score">
                valid score
              </AboutLink>{" "}
              to be <AccentText>considered an FC</AccentText> for completion.
            </p>
            <p>
              Due to osu! limitations, there is an important{" "}
              <AboutLink url="/about/bounties#fc-ruling">ruling</AboutLink> on
              what qualifies as a full-combo in Marksman.
            </p>
            <p>
              The full-combo type has a “Stable-Combo-Threshold” property that
              can be customized by the bounty creator, see{" "}
              <AboutLink url="/about/bounties#fc-ruling">
                FC evaluation ruling
              </AboutLink>
              .
            </p>
          </AboutSubSection>
          <AboutSubSection id="minimum-grade" index="2.">
            <p>
              The <AccentText>minimum grade</AccentText> type requires the{" "}
              <AboutLink url="/about/hunting#what-is-valid-score">
                valid score
              </AboutLink>{" "}
              to be graded <AccentText>at or above</AccentText> a user-defined{" "}
              <AboutLink url="/about/bounties#grade-requirement">
                grade requirement
              </AboutLink>
              .
            </p>
          </AboutSubSection>
        </AboutSubSection>
        <AboutSubSection id="accuracy" index="IV.">
          <p>
            The goal <AccentText>accuracy</AccentText> is an{" "}
            <AccentText>optional</AccentText> requirement. It requires the{" "}
            <AboutLink url="/about/hunting#what-is-valid-score">
              valid score
            </AboutLink>{" "}
            to have an accuracy <AccentText>at or above</AccentText> a specific
            percentage value, chosen by the bounty creator.
          </p>
        </AboutSubSection>
        <AboutSubSection id="mod-rules" index="V.">
          <p>
            The goal <AccentText>mod requirement rules</AccentText> are of four
            different categories, one must be chosen by the bounty creator, they
            are as follows:
          </p>
          <AboutSubSection id="any-mods" index="1.">
            <p>
              The <AccentText>any mods</AccentText> rule allows any valid osu!
              mod combination to be used for the{" "}
              <AboutLink url="/about/hunting#what-is-valid-score">
                valid score
              </AboutLink>{" "}
              to qualify.
            </p>
            <p>
              However it excludes scores set using unsupported mods, see{" "}
              <AboutLink url="/about/bounties#supported-mods">
                supported mods
              </AboutLink>
              .
            </p>
          </AboutSubSection>
          <AboutSubSection id="exact-mods" index="2.">
            <p>
              The <AccentText>exact mods</AccentText> rule requires the{" "}
              <AboutLink url="/about/hunting#what-is-valid-score">
                valid score
              </AboutLink>{" "}
              to have the <AccentText>exact same</AccentText> mod combination
              (in no particular order) as selected by the bounty creator to
              qualify.
            </p>
          </AboutSubSection>
          <AboutSubSection id="included-mods" index="3.">
            <p>
              The <AccentText>included mods</AccentText> rule requires the{" "}
              <AboutLink url="/about/hunting#what-is-valid-score">
                valid score
              </AboutLink>{" "}
              to <AccentText>contain</AccentText> the mod combination selected
              by the bounty creator to qualify, but any other supported mod
              combination can be added as well, see{" "}
              <AboutLink url="/about/bounties#supported-mods">
                supported mods
              </AboutLink>
              .
            </p>
          </AboutSubSection>
          <AboutSubSection id="excluded-mods" index="4.">
            <p>
              The <AccentText>excluded mods</AccentText> rule requires the{" "}
              <AboutLink url="/about/hunting#what-is-valid-score">
                valid score
              </AboutLink>{" "}
              to <AccentText>not contain</AccentText> any of the mods selected
              by the bounty creator to qualify.
            </p>
          </AboutSubSection>
        </AboutSubSection>
      </AboutSection>
      <AboutSection title="What qualifies as a full-combo?" id="fc-ruling">
        <p>
          Due to the fact that <AccentText>osu!stable scores</AccentText> do not
          store sufficient data to determine if a score is an FC (namely the
          lack of a sliderbreak count value), Marksman cannot reliably evaluate
          if a score is <AccentText>effectively a full-combo</AccentText> across
          clients.
        </p>
        <p>
          To circumvent this discrepancy, Marksman requires a{" "}
          <AccentText>minimum combo</AccentText> to be reached for an{" "}
          <AccentText>osu!stable score</AccentText> to be considered an FC.
        </p>
        <p>
          The metric used to quantify this minimum combo is the{" "}
          <AccentText>“Stable-Combo-Threshold”</AccentText>, it is a percentage
          and can manually be set when creating a bounty, its default value is{" "}
          <AccentText>99%</AccentText>.
        </p>
        <p>
          It represents the <AccentText>minimum percentage</AccentText> of combo
          to achieve over the{" "}
          <AccentText>bounty’s beatmap maximum combo</AccentText> for the score
          to be considered an FC{" "}
          <AccentText>if it was set on osu!stable</AccentText>.
        </p>
        <p>
          In effect, this means that an{" "}
          <AccentText>osu!stable score</AccentText> that is{" "}
          <AccentText>not a real full-combo</AccentText> but has a combo{" "}
          <AccentText>at or above the set threshold</AccentText> and a miss
          count of 0 can be considered an FC and{" "}
          <AccentText>complete the bounty</AccentText> if its{" "}
          <AboutLink url="/about/bounties#goal-types">type</AboutLink> is
          full-combo and the score meets every other requirement.{" "}
        </p>
        <p>
          However,{" "}
          <AccentText>
            osu!lazer scores are not subject to this limitation
          </AccentText>{" "}
          because the supplied data from osu! is sufficient to reliably tell if
          an osu!lazer score is effectively a full-combo.
        </p>
        <p>
          Depending on <AccentText>what client you play</AccentText>, the
          Marksman FC ruling then works differently:
        </p>
        <div className="my-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <section className="border border-border rounded text-center bg-surface-raised p-2 text-sm flex flex-col gap-2">
            <h2 className="font-bold text-lg text-foreground-muted">
              For scores set on osu!stable
            </h2>
            <p>
              The score must have a <AccentText>miss count of 0</AccentText>.
            </p>
            <p>
              The score must have a{" "}
              <AccentText>
                combo at or above the calculated minimum required combo
              </AccentText>
              .
            </p>
            <p
              className={`wrap-anywhere bg-card ${aes_font.className} font-bold`}
            >
              MinimumCombo = ceil(threshold / 100 × max combo)
            </p>
          </section>
          <section className="border border-border rounded text-center bg-surface-raised p-2 text-sm flex flex-col gap-2">
            <h2 className="font-bold text-lg text-foreground-muted">
              For scores set on osu!lazer
            </h2>
            <p>
              The score must have a <AccentText>miss count of 0</AccentText>.
            </p>
            <p>
              The score must have a{" "}
              <AccentText>sliderbreak count of 0</AccentText>.
            </p>
            <p>
              The score <AccentText>combo isn't checked</AccentText>.
            </p>
          </section>
        </div>
      </AboutSection>
      <AboutSection title="Grade requirement" id="grade-requirement">
        <p>
          Marksman bounties can be of the{" "}
          <AccentText>grade requirement</AccentText>{" "}
          <AboutLink url="/about/bounties#goal-types">type</AboutLink>, in which
          case the completion requires the{" "}
          <AboutLink url="/about/hunting#what-is-valid-score">
            valid score
          </AboutLink>{" "}
          to be graded <AccentText>at or above</AccentText> the selected grade.
        </p>
        <p> The grades are ordered as follows:</p>
        <div className="flex flex-col sm:flex-row my-2 sm:gap-2 text-xl font-bold place-content-center items-center">
          <GradeIcon grade="D" />
          <span>{"<"}</span>
          <GradeIcon grade="C" />
          <span>{"<"}</span>
          <GradeIcon grade="B" />
          <span>{"<"}</span>
          <GradeIcon grade="A" />
          <span>{"<"}</span>
          <div className="flex flex-row sm:flex-col gap-1">
            <GradeIcon grade="S" />
            <GradeIcon grade="SH" />
          </div>
          <span>{"<"}</span>
          <div className="flex flex-row sm:flex-col gap-1">
            <GradeIcon grade="X" />
            <GradeIcon grade="XH" />
          </div>
        </div>
      </AboutSection>
      <AboutSection title="Supported mods" id="supported-mods">
        <p>
          In order to avoid any potential abuse, notably with osu!lazer
          customizable mods,{" "}
          <AccentText>Marksman uses a strict list of supported mods</AccentText>
          .
        </p>
        <p>
          This means that when attempting completion, when using mods, the{" "}
          <AboutLink url="/about/hunting#what-is-valid-score">
            valid score
          </AboutLink>{" "}
          <AccentText>must exclude any mod that is not in the list</AccentText>{" "}
          of supported mods, regardless of the selected{" "}
          <AboutLink url="/about/bounties#mod-rules">
            mod requirement rule
          </AboutLink>
          .
        </p>
        <p>
          Mod customization is also <AccentText>not allowed</AccentText>.
        </p>
        <p>
          The <AccentText>supported mods</AccentText> list is as follows:
        </p>
        <div className="flex flex-col sm:flex-row w-full my-2 place-content-center gap-2">
          <ModIcon mod="HD" />
          <ModIcon mod="HR" />
          <ModIcon mod="DT" />
          <ModIcon mod="FL" />
          <ModIcon mod="EZ" />
          <ModIcon mod="HT" />
          <ModIcon mod="NF" />
          <ModIcon mod="SO" />
        </div>
      </AboutSection>
      <AboutSection title="Bounty statuses" id="bounty-status">
        <p>A Marksman bounty can be one of the following statuses:</p>
        <AboutSubSection index="I." id="open-bounty">
          <AccentText>Open</AccentText>, which means ongoing: this bounty has
          not yet been completed by a player and{" "}
          <AccentText>can still be hunted</AccentText>. It also means that it{" "}
          <AccentText>can still be cancelled</AccentText> by its creator.
        </AboutSubSection>
        <AboutSubSection index="II." id="closed-bounty">
          <AccentText>Completed</AccentText>, or closed: this bounty has been
          completed by a player and <AccentText>cannot be hunted</AccentText>{" "}
          for completion. It <AccentText>cannot be cancelled</AccentText> by its
          creator.
        </AboutSubSection>
        <AboutSubSection index="III." id="cancelled-bounty">
          <AccentText>Cancelled</AccentText>: this bounty was cancelled by its
          creator, meaning that the initial{" "}
          <AccentText>reward was refunded</AccentText> (without the creation
          fee) and it <AccentText>can no longer be hunted</AccentText> for
          completion.
        </AboutSubSection>
      </AboutSection>
      <AboutSection title="Reward tiers" id="reward-tiers">
        <p>
          Marksman bounties feature a{" "}
          <AccentText>cosmetic subdivision</AccentText> for their BP reward.
        </p>
        <p>They are as follows, with their corresponding BP minimum:</p>
        <div className="flex place-content-center">
          <div className="flex flex-col gap-1 w-full max-w-sm bg-surface-raised p-1 border border-border rounded">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <BountyTierBadge tier="Easy" size="lg" className="w-full" />
              <span className="font-bold whitespace-nowrap text-right">
                BP ≥ <span className="text-accent">0</span>
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <BountyTierBadge tier="Normal" size="lg" className="w-full" />
              <span className="font-bold whitespace-nowrap text-right">
                BP ≥ <span className="text-accent">100</span>
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <BountyTierBadge tier="Hard" size="lg" className="w-full" />
              <span className="font-bold whitespace-nowrap text-right">
                BP ≥ <span className="text-accent">300</span>
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <BountyTierBadge tier="Lunatic" size="lg" className="w-full" />
              <span className="font-bold whitespace-nowrap text-right">
                BP ≥ <span className="text-accent">1,000</span>
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <BountyTierBadge tier="Extra" size="lg" className="w-full" />
              <span className="font-bold whitespace-nowrap text-right">
                BP ≥ <span className="text-accent">3,000</span>
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <BountyTierBadge tier="Phantasm" size="lg" className="w-full" />
              <span className="font-bold whitespace-nowrap text-right">
                BP ≥ <span className="text-accent">10,000</span>
              </span>
            </div>
          </div>
        </div>
      </AboutSection>
    </div>
  );
}
