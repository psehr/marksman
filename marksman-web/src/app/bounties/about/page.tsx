import { InfoSection } from "@/components/bounty_details/InfoSection";

export default function AboutPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center p-12 gap-8">
      <div className="flex flex-col gap-4 items-center">
        <h1 className="text-2xl">GENERAL RULING</h1>
        <p className="w-1/2 text-center">
          The following rules apply for all bounty claiming attempts
        </p>
        <InfoSection title="Eligibility">
          <div className="text-sm">
            <p>Score must be set after bounty creation</p>
            <p>Score must belong to the claimant</p>
            <p>Score must be set on osu!standard</p>
            <p>Bounty cannot be claimed by its owner</p>
            <p>The first successful claim wins</p>
          </div>
        </InfoSection>
      </div>
      <h1 className="text-2xl">FULL-COMBO RULING</h1>
      <p className="w-1/4 text-center">
        System limitations forces the implementation of a "minimum combo
        threshold to be considered an FC" for plays set on older osu! clients.
      </p>
      <p className="w-1/4 text-center">
        However, plays set on osu!lazer offer enough data to accurately
        determine if a score is truly a full-combo or not.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <InfoSection title="osu!Stable Client">
          <section className="flex flex-col text-sm">
            <p>Miss count must be 0</p>
            <p>Combo must be {">="} MIN_COMBO/MAX_COMBO</p>
            <p>SB count isn't checked, only combo matters</p>
          </section>
        </InfoSection>
        <InfoSection title="osu!Lazer Client">
          <section className="flex flex-col text-sm">
            <p>Miss count must be 0</p>
            <p>SB count must be 0</p>
            <p>Allows dropped sliderends</p>
          </section>
        </InfoSection>
      </div>
    </div>
  );
}
