import Link from "next/link";
import CreateBountyForm from "@/components/bounties/CreateBountyForm";
import BountyCreationTool from "@/components/bounties/creation-tool/BountyCreationTool";
import { InfoSection } from "@/components/ui/InfoSection";
import { aes_font } from "@/lib/fonts";

export default function BountyCreationToolPage() {
  return (
    <main className="flex flex-col items-center py-12 sm:py-24 gap-12 px-4">
      <h1
        className={`text-3xl font-bold text-foreground-muted ${aes_font.className}`}
      >
        Bounty Creation Tool
      </h1>
      <BountyCreationTool />
    </main>
  );
}
