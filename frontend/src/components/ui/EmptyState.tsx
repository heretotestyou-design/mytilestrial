import { Icon, type IconName } from "./Icon";

export function EmptyState({ icon, title, children }: Readonly<{ icon: IconName; title: string; children?: React.ReactNode }>) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-stone-500 shadow-[inset_0_0_0_1px_rgba(18,16,14,0.06)]">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 text-[14px] font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-xs text-[13px] text-stone-600">{children}</div>}
    </div>
  );
}
