import { WikiSection } from "@/components/wiki/WikiSection";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function WikiEconomyPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge icon="economy">Wiki - Economy</PageHeaderBadge>
      <WikiSection title="Marksman economy system" id="marksman-economy">
        <p>[ This section lacks information for now ]</p>
      </WikiSection>
      <WikiSection title="What are Bounty Points?" id="bounty-points">
        <p>[ This section lacks information for now ]</p>
      </WikiSection>
    </div>
  );
}
