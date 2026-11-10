import BountyCreationTool from "@/components/bounties/creation-tool/BountyCreationTool";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function BountyCreationToolPage() {
  return (
    <main className="flex flex-col items-center py-6 sm:py-12 gap-4 sm:gap-8 px-4">
      <PageHeaderBadge icon="create">Bounty Creation Tool</PageHeaderBadge>
      <BountyCreationTool />
    </main>
  );
}
