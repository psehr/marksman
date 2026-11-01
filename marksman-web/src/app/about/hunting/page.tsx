import { AboutSection } from "@/components/about/AboutSection";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function AboutHuntingPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge>About - Hunting</PageHeaderBadge>
      <AboutSection title="What is hunting?" id="what-is-hunting">
        <p>[ This section lacks information for now ]</p>
      </AboutSection>
      <AboutSection title="What is a valid score?" id="what-is-valid-score">
        <p>[ This section lacks information for now ]</p>
      </AboutSection>
    </div>
  );
}
