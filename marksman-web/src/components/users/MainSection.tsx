export function MainSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-6xl bg-surface rounded shadow-md border border-border flex flex-col items-center gap-8 p-4 sm:p-8">
      {children}
    </div>
  );
}
