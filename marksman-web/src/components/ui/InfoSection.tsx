export function InfoSection({
  title,
  children,
  className,
  contentClassName,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded border border-border bg-surface text-center ${className}`}
    >
      <h1 className="bg-linear-to-l from-background to-transparent rounded-t px-4 p-2 font-bold text-lg text-right border-b border-dashed border-border">
        {title}
      </h1>
      <div className={contentClassName ?? "mx-4 m-2 h-full flex flex-col place-content-center items-center"}>
        {children}
      </div>
    </section>
  );
}
