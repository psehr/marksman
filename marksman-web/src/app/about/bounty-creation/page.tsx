import { AboutSection } from "@/components/about/AboutSection";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function BountyCreationAboutPage() {
  return (
    <div className="flex flex-col w-full h-full place-content-center items-center px-4 py-12 gap-4">
      <PageHeaderBadge icon="create">About - Bounty Creation</PageHeaderBadge>
      <AboutSection
        title="Creating your first bounty"
        id="create-your-first-bounty"
      >
        <p>[ This section lacks information for now ]</p>
      </AboutSection>
    </div>
  );
}
