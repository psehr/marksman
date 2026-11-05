const sizes = {
  sm: "max-w-3xs",
  md: "max-w-sm",
  lg: "max-w-md",
};

const columnStyles = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
};

export type ContainerSize = keyof typeof sizes;
export type ColumnClass = keyof typeof columnStyles;

export default function UserStatsCardContainer({
  children,
  cols,
  size = "md",
}: {
  children: React.ReactNode;
  cols: ColumnClass;
  size?: ContainerSize;
}) {
  return (
    <div
      className={`w-full min-w-0 ${sizes[size]} sm:h-32 flex bg-card border border-border rounded p-2 gap-4`}
    >
      <div
        className={`grid ${columnStyles[cols]} size-full gap-2 sm:gap-0 p-1 bg-card-darker rounded border border-border/30 shadow-[inset_0_2px_8px_rgb(0_0_0/0.7)]`}
      >
        {children}
      </div>
    </div>
  );
}
