import Link from "next/link";
import { useAuth } from "../AuthProvider";

export default function LoginButton() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Link
        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/osu`}
        className="rounded bg-sky-700 px-4 py-2 text-white w-fit"
      >
        Log in with osu!
      </Link>
    );
  }
}
