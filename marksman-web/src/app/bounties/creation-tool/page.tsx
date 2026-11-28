import BountyCreationTool from "@/components/bounties/creation-tool/BountyCreationTool";

export default function BountyCreationToolPage() {
  return (
    <main className="flex flex-col items-center py-6 sm:py-12 gap-4 sm:gap-8 px-4">
      <h1 className="sr-only">Bounty Creation Tool</h1>
      <BountyCreationTool />
    </main>
  );
}
