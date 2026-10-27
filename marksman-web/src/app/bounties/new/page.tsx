import Link from "next/link";
import CreateBountyForm from "@/components/bounties/CreateBountyForm";

export default function NewBountyPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/bounties" className="underline">
        Back to bounties
      </Link>
      <h1 className="text-2xl font-bold">Create a bounty</h1>
      <CreateBountyForm />
    </main>
  );
}
