import { AboutSection } from "@/components/about/AboutSection";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function AboutEconomyPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge>About - Economy</PageHeaderBadge>
      <AboutSection title="Marksman economy system" id="marksman-economy">
        <p>[ This section lacks information for now ]</p>
      </AboutSection>
      <AboutSection title="What are Bounty Points?" id="bounty-points">
        <p>[ This section lacks information for now ]</p>
      </AboutSection>
    </div>
  );
}
