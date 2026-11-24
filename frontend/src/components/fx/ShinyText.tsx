// Shimmering text (React Bits "ShinyText" style). Pure CSS.
import { cn } from "@/lib/format";

export function ShinyText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "animate-shine bg-[length:200%_100%] bg-clip-text text-transparent",
        "bg-[linear-gradient(110deg,#a69b8c_35%,#f6f2eb_50%,#a69b8c_65%)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
