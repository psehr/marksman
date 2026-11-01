import { SectionAnchor } from "./SectionAnchor";

export function AboutSection({
  children,
  title,
  id,
}: {
  children: React.ReactNode;
  title: string;
  id: string;
}) {
  return (
    <SectionAnchor
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-4 w-full max-w-2xl bg-surface border border-border data-[selected=true]:border-accent scroll-mt-4 rounded p-2 px-4 text-justify"
    >
      <h2
        id={`${id}-heading`}
        className="text-xl font-bold text-foreground-muted"
      >
        <a
          href={`#${id}`}
          className="rounded focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          # {title}
        </a>
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </SectionAnchor>
  );
}
