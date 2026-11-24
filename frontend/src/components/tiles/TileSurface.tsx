// Renders a seamless tiled surface as SVG. Server-safe (no hooks).
import { FINISHES, GROUTS, LAYOUTS, rand, type Finish, type PatternId } from "./patterns";

type Props = {
  id: string;
  pattern?: PatternId;
  finish?: Finish;
  grout?: string;
  /** Size of one tile unit in px */
  unit?: number;
  /** Grout width in px */
  gap?: number;
  className?: string;
};

export function TileSurface({
  id,
  pattern = "grid",
  finish = FINISHES[0],
  grout = GROUTS[0].color,
  unit = 64,
  gap = 2,
  className,
}: Props) {
  const layout = LAYOUTS[pattern];
  const pid = `tp-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const W = layout.cell.w * unit;
  const H = layout.cell.h * unit;

  return (
    <svg className={className} width="100%" height="100%" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${pid}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={finish.light} />
          <stop offset="0.55" stopColor={finish.base} />
          <stop offset="1" stopColor={finish.base} />
        </linearGradient>
        <linearGradient id={`${pid}-b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={finish.alt} stopOpacity="0.85" />
          <stop offset="1" stopColor={finish.alt} />
        </linearGradient>
        <pattern id={pid} width={W} height={H} patternUnits="userSpaceOnUse">
          <rect width={W} height={H} fill={grout} />
          {layout.tiles.map((t, i) => {
            const fill = pattern === "checker" && t.alt ? `url(#${pid}-b)` : `url(#${pid}-a)`;
            const x = t.x * unit + gap / 2;
            const y = t.y * unit + gap / 2;
            const w = t.w * unit - gap;
            const h = t.h * unit - gap;
            const shade = rand(t.seed + i);
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} fill={fill} rx={0.6} />
                {/* subtle per-tile tone variation, like real stone */}
                <rect x={x} y={y} width={w} height={h} fill={shade > 0.5 ? "#fff" : "#000"} opacity={Math.abs(shade - 0.5) * 0.08} />
                {/* a faint vein on some tiles */}
                {shade > 0.62 && (
                  <path
                    d={`M ${x} ${y + h * shade} Q ${x + w * 0.5} ${y + h * (1 - shade)} ${x + w} ${y + h * (shade * 0.7)}`}
                    stroke={finish.alt}
                    strokeOpacity={0.35}
                    strokeWidth={0.7}
                    fill="none"
                  />
                )}
              </g>
            );
          })}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}
