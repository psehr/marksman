import { SectionAnchor } from "./SectionAnchor";

export function AboutSubSection({
  children,
  index,
  id,
}: {
  children: React.ReactNode;
  index: string;
  id: string;
}) {
  return (
    <SectionAnchor
      id={id}
      className="text-justify pl-2 sm:pl-8 flex flex-row border border-transparent data-[selected=true]:border-accent rounded scroll-mt-4"
    >
      <a
        href={`#${id}`}
        aria-label={`Link to ${id.replaceAll("-", " ")}`}
        className="pr-4 rounded focus-visible:outline-2 focus-visible:outline-accent min-w-10"
      >
        {index}
      </a>
      <div>{children}</div>
    </SectionAnchor>
  );
}
