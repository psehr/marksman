import PageHeaderBadge from "@/components/ui/PageHeaderBadge";
import { WikiLink } from "@/components/wiki/WikiLink";
import { WikiSubSection } from "@/components/wiki/WikiSubSection";
import { WikiSection } from "@/components/wiki/WikiSection";
import { AccentText } from "@/components/wiki/AccentText";
import { aes_font } from "@/lib/fonts";
import GradeIcon from "@/components/osu/GradeIcon";
import ModIcon from "@/components/osu/ModIcon";
import BountyTierBadge from "@/components/bounties/BountyTierBadge";
import BPIcon from "@/components/economy/BPIcon";

export default function WikiBountiesPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge icon="browse">Wiki - Bounties</PageHeaderBadge>
      <WikiSection id="what-are-bounties" title="What are bounties?">
        <p>
          Bounties are <AccentText>user-made challenges</AccentText> that can be
          completed by other players using the{" "}
          <WikiLink url="/wiki/hunting">hunting system</WikiLink>, they can
          be created by any player using the{" "}
          <AccentText>Bounty Creation Tool</AccentText>.
        </p>
        <p>
          An open bounty <AccentText>can be cancelled</AccentText> by its
          creator at any time, its{" "}
          <WikiLink url="/wiki/bounties#bounty-status">status</WikiLink> then
          changes and it can no longer be completed afterwards.
        </p>
        <p>
          The six <AccentText>main characteristics</AccentText> of bounties are
          the following:
        </p>
        <WikiSubSection id="reward" index="I.">
          <p>
            The bounty <AccentText>reward</AccentText> is a positive integer
            amount of{" "}
            <WikiLink url="/wiki/economy#bounty-points">
              Bounty Points (BP)
            </WikiLink>{" "}
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
        </WikiSubSection>
        <WikiSubSection id="beatmap" index="II.">
          <p>
            The goal <AccentText>beatmap</AccentText> is a specific{" "}
            <AccentText>osu!standard</AccentText> difficulty of a{" "}
            <AccentText>Ranked, Loved or Approved</AccentText> beatmapset, it is
            chosen by the bounty creator.
          </p>
          <p>
            To successfully complete the bounty, the{" "}
            <WikiLink url="/wiki/hunting#what-is-valid-score">
              valid score
            </WikiLink>{" "}
            must be set on <AccentText>this specific beatmap</AccentText>.
          </p>
        </WikiSubSection>
        <WikiSubSection id="goal-types" index="III.">
          <p>
            The goal <AccentText>types</AccentText> are of two different
            categories, one must be chosen by the bounty creator, they are as
            follows:
          </p>
          <WikiSubSection id="full-combo" index="1.">
            <p>
              The <AccentText>full-combo</AccentText> type requires the{" "}
              <WikiLink url="/wiki/hunting#what-is-valid-score">
                valid score
              </WikiLink>{" "}
              to be <AccentText>considered an FC</AccentText> for completion.
            </p>
            <p>
              Due to osu! limitations, there is an important{" "}
              <WikiLink url="/wiki/bounties#fc-ruling">ruling</WikiLink> on
              what qualifies as a full-combo in Marksman.
            </p>
            <p>
              The full-combo type has a “Stable-Combo-Threshold” property that
              can be customized by the bounty creator, see{" "}
              <WikiLink url="/wiki/bounties#fc-ruling">
                FC evaluation ruling
              </WikiLink>
              .
            </p>
          </WikiSubSection>
          <WikiSubSection id="pass" index="2.">
            <p>
              The <AccentText>Pass</AccentText> type requires a passed score
              without No Fail (NF). Optional grade and accuracy requirements
              also apply when set.
            </p>
          </WikiSubSection>
        </WikiSubSection>
        <WikiSubSection id="accuracy" index="IV.">
          <p>
            The goal <AccentText>accuracy</AccentText> is an{" "}
            <AccentText>optional</AccentText> requirement. It requires the{" "}
            <WikiLink url="/wiki/hunting#what-is-valid-score">
              valid score
            </WikiLink>{" "}
            to have an accuracy <AccentText>at or above</AccentText> a specific
            percentage value, chosen by the bounty creator.
          </p>
        </WikiSubSection>
        <WikiSubSection id="minimum-grade" index="V.">
          <p>
            A <AccentText>minimum grade</AccentText> is an optional requirement
            for either Pass or Full-Combo bounties. The score must achieve the
            selected grade or higher, as explained in the{" "}
            <WikiLink url="/wiki/bounties#grade-requirement">grade requirement</WikiLink>
            {" "}section. If minimum accuracy is also set, both requirements must
            be met alongside the goal and mod requirements.
          </p>
        </WikiSubSection>
        <WikiSubSection id="mod-rules" index="VI.">
          <p>
            A bounty's mod requirements determine which mods a qualifying score
            must use or avoid. Mods can be <AccentText>required</AccentText>,{" "}
            <AccentText>forbidden</AccentText> or <AccentText>optional</AccentText>.
            A bounty can require some mods while forbidding others.
          </p>
          <WikiSubSection id="any-mods" index="1.">
            <p>
              Unless exact mods are required, additional supported mods may be
              used alongside the required mods, provided no forbidden mods are
              present. If no mods are required or forbidden, any supported
              combination satisfies the mod requirements. Other score and goal
              requirements still apply.
            </p>
          </WikiSubSection>
          <WikiSubSection id="exact-mods" index="2.">
            <p>
              <AccentText>Exact mods</AccentText> means a score must use all
              required mods and no additional mods, in any order. An exact
              requirement with no required mods means <AccentText>No Mod (NM)</AccentText>.
              Classic (CL) and Spun Out (SO) are ignored when they have no custom
              settings, including for exact and NM requirements.
            </p>
          </WikiSubSection>
          <WikiSubSection id="included-mods" index="3.">
            <p>
              <AccentText>Required mods</AccentText> must all be present in the
              score. For example, requiring HD and HR means both must be used.
              Additional supported mods are allowed unless exact mods are required.
            </p>
          </WikiSubSection>
          <WikiSubSection id="excluded-mods" index="4.">
            <p>
              <AccentText>Forbidden mods</AccentText> must all be absent from
              the score and appear crossed out. For example, a bounty requiring
              HD and forbidding HT permits HDHR when additional mods are allowed,
              but rejects any score using HT.
            </p>
          </WikiSubSection>
        </WikiSubSection>
      </WikiSection>
      <WikiSection title="What qualifies as a full-combo?" id="fc-ruling">
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
          <WikiLink url="/wiki/bounties#goal-types">type</WikiLink> is
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
              className={`wrap-anywhere bg-card ${aes_font.className} font-bold rounded p-1`}
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
      </WikiSection>
      <WikiSection title="Grade requirement" id="grade-requirement">
        <p>
          Either <WikiLink url="/wiki/bounties#goal-types">goal type</WikiLink>
          {" "}can have an optional <AccentText>minimum grade</AccentText>
          {" "}requirement. When set, completion requires the{" "}
          <WikiLink url="/wiki/hunting#what-is-valid-score">
            valid score
          </WikiLink>{" "}
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
      </WikiSection>
      <WikiSection title="Supported mods" id="supported-mods">
        <p>
          In order to avoid any potential abuse, notably with osu!lazer
          customizable mods,{" "}
          <AccentText>Marksman uses a strict list of supported mods</AccentText>
          .
        </p>
        <p>
          This means that when attempting completion, when using mods, the{" "}
          <WikiLink url="/wiki/hunting#what-is-valid-score">
            valid score
          </WikiLink>{" "}
          <AccentText>must exclude any mod that is not in the list</AccentText>{" "}
          of supported mods, regardless of the selected{" "}
          <WikiLink url="/wiki/bounties#mod-rules">
            mod requirement rule
          </WikiLink>
          , except for <AccentText>Classic (CL)</AccentText> and{" "}
          <AccentText>Spun Out (SO)</AccentText>, which are{" "}
          <AccentText>ignored</AccentText> during verification when they have no custom settings.
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
        </div>
      </WikiSection>
      <WikiSection title="Bounty statuses" id="bounty-status">
        <p>A Marksman bounty can be one of the following statuses:</p>
        <WikiSubSection index="I." id="open-bounty">
          <AccentText>Open</AccentText>, which means ongoing: this bounty has
          not yet been completed by a player and{" "}
          <AccentText>can still be hunted</AccentText>. It also means that it{" "}
          <AccentText>can still be cancelled</AccentText> by its creator.
        </WikiSubSection>
        <WikiSubSection index="II." id="closed-bounty">
          <AccentText>Completed</AccentText>, or closed: this bounty has been
          completed by a player and <AccentText>cannot be hunted</AccentText>{" "}
          for completion. It <AccentText>cannot be cancelled</AccentText> by its
          creator.
        </WikiSubSection>
        <WikiSubSection index="III." id="cancelled-bounty">
          <AccentText>Cancelled</AccentText>: this bounty was cancelled by its
          creator, meaning that the initial{" "}
          <AccentText>reward was refunded</AccentText> (without the creation
          fee) and it <AccentText>can no longer be hunted</AccentText> for
          completion.
        </WikiSubSection>
      </WikiSection>
      <WikiSection title="Reward tiers" id="reward-tiers">
        <p>
          Marksman bounties feature a{" "}
          <AccentText>cosmetic subdivision</AccentText> for their BP reward.
        </p>
        <p>They are as follows, with their corresponding BP range:</p>
        <div className="flex place-content-center">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 sm:gap-x-6 w-full max-w-sm bg-surface-raised p-1 sm:pr-5 border border-border rounded">
            <div className="contents">
              <BountyTierBadge tier="Easy" size="lg" className="w-full" />
              <div className="flex gap-1 font-bold whitespace-nowrap place-content-center items-center">
                <span className="text-accent">1 - 99</span>
                <BPIcon size="sm" />
              </div>
            </div>
            <div className="contents">
              <BountyTierBadge tier="Normal" size="lg" className="w-full" />
              <div className="flex gap-1 font-bold whitespace-nowrap place-content-center items-center">
                <span className="text-accent">100 - 299</span>
                <BPIcon size="sm" />
              </div>
            </div>
            <div className="contents">
              <BountyTierBadge tier="Hard" size="lg" className="w-full" />
              <div className="flex gap-1 font-bold whitespace-nowrap place-content-center items-center">
                <span className="text-accent">300 - 999</span>
                <BPIcon size="sm" />
              </div>
            </div>
            <div className="contents">
              <BountyTierBadge tier="Lunatic" size="lg" className="w-full" />
              <div className="flex gap-1 font-bold whitespace-nowrap place-content-center items-center">
                <span className="text-accent">1,000 - 2,999</span>
                <BPIcon size="sm" />
              </div>
            </div>
            <div className="contents">
              <BountyTierBadge tier="Extra" size="lg" className="w-full" />
              <div className="flex gap-1 font-bold whitespace-nowrap place-content-center items-center">
                <span className="text-accent">3,000 - 9,999</span>
                <BPIcon size="sm" />
              </div>
            </div>
            <div className="contents">
              <BountyTierBadge tier="Phantasm" size="lg" className="w-full" />
              <div className="flex gap-1 font-bold whitespace-nowrap place-content-center items-center">
                <span className="text-accent">≥ 10,000</span>
                <BPIcon size="sm" />
              </div>
            </div>
          </div>
        </div>
      </WikiSection>
    </div>
  );
}
