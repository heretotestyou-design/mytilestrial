import { cn } from "@/lib/format";

type CardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right side of the header: a link, badge or control. */
  action?: React.ReactNode;
  /** Sticky footer row, e.g. form buttons. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

/** The standard glass surface with an optional header and footer. */
export function Card({ title, description, action, footer, children, className, id }: Readonly<CardProps>) {
  return (
    <section id={id} className={cn("glass flex flex-col rounded-[18px]", className)}>
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-ink/[0.06] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-stone-600">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="flex-1">{children}</div>
      {footer && (
        <footer className="flex items-center justify-end gap-3 rounded-b-[18px] border-t border-ink/[0.06] bg-white/40 px-6 py-3.5">{footer}</footer>
      )}
    </section>
  );
}
