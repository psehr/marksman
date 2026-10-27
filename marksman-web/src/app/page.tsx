import BountyCard from "@/components/bounties/BountyCard";
import Button from "@/components/ui/Button";
import { Anonymous_Pro, Encode_Sans } from "next/font/google";

const ano = Anonymous_Pro({ subsets: ["latin"], weight: "400" });
const enc = Encode_Sans({ subsets: ["latin"], weight: ["400", "700"] });

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface w-full max-w-2xl space-y-2 rounded p-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

export default async function Home() {
  return (
    <div
      className={`flex min-h-screen flex-col items-center p-16 ${enc.className} text-foreground space-y-6`}
    >
      <InfoSection title={"Example container"}>
        <p>This is a standard descriptive paragraph.</p>
        <p className="text-foreground-muted">
          This is a secondary descriptive paragraph.
        </p>
      </InfoSection>

      <span className="border-border w-1/3 border"></span>

      <div className="flex flex-wrap justify-center gap-4">
        <Button size="md" variant="accent">
          Start hunting
        </Button>
        <Button>Bookmark bounty</Button>
        <Button size="md" variant="confirm">
          Confirm
        </Button>
        <Button size="md" variant="danger">
          Cancel bounty
        </Button>
      </div>

      <span className="border-border w-1/3 border"></span>

      <InfoSection title="Message examples">
        <p className="text-success">
          This message describes a successful event.
        </p>
        <p className="text-warning">This message describes a warning event.</p>
        <p className="text-danger">This message describes a dangerous event.</p>
      </InfoSection>
    </div>
  );
}
