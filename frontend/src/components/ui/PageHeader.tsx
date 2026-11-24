export function PageHeader({ title, description, children }: Readonly<{ title: React.ReactNode; description?: string; children?: React.ReactNode }>) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 text-[14.5px] text-stone-600">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
