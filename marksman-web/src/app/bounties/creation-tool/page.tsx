import BountyCreationTool from "@/components/bounties/creation-tool/BountyCreationTool";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";

export default function BountyCreationToolPage() {
  return (
    <main className="flex flex-col items-center py-12 gap-8 px-4">
      <PageHeaderBadge>Bounty Creation Tool</PageHeaderBadge>
      <BountyCreationTool />
    </main>
  );
}
