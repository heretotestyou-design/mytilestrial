import { cn } from "@/lib/format";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "bronze";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink/[0.05] text-stone-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  bronze: "bg-bronze/15 text-bronze-dark",
};

export function Badge({ tone = "neutral", children, className }: Readonly<{ tone?: BadgeTone; children: React.ReactNode; className?: string }>) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium", TONES[tone], className)}>{children}</span>;
}
