import Link from "next/link";

export default function Footer() {
  return (
    <footer className="flex items-center bg-surface text-sm text-foreground-muted border-t border-border px-4 place-content-between min-h-8 flex-wrap gap-x-4 gap-y-1 py-1">
      <Link href="https://osu.ppy.sh/" className="underline">
        osu!
      </Link>
      <div className="flex gap-1">
        <span>Marksman</span>
        <span>-</span>
        <p>
          Release <span className="font-bold text-accent">α</span>
        </p>
      </div>
      <p>
        <Link href="https://github.com/psehr/marksman" className="underline">
          Github
        </Link>{" "}
        -{" "}
        <Link href="https://osu.ppy.sh/users/9239673" className="underline">
          @psehr
        </Link>
      </p>
    </footer>
  );
}
