"use client";

import { useId } from "react";
import { useObjectUrl } from "@/lib/hooks";
import type { FloorLayout } from "@/lib/types";
import { useRememberedState } from "./hooks";

type Direction = FloorLayout["direction"];
type Dimensions = { width: string; length: string };
const EMPTY: Dimensions = { width: "", length: "" };
const directions = ["horizontal", "vertical"] as const;
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function dimension(value: string) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function axis(floor: number, tile: number) {
  const ratio = floor / tile;
  // Decimal feet can leave a tiny floating-point remainder at an exact fit.
  const nearest = Math.round(ratio);
  const exact = nearest > 0 && Math.abs(ratio - nearest) <= 4 * Number.EPSILON * ratio;
  return exact ? { total: nearest, whole: nearest } : { total: Math.ceil(ratio), whole: Math.floor(ratio) };
}

function calculatePlan(floor: Dimensions, tile: Dimensions, direction: Direction) {
  const floorWidthFeet = dimension(floor.width);
  const floorLengthFeet = dimension(floor.length);
  const floorWidth = floorWidthFeet * 12;
  const floorLength = floorLengthFeet * 12;
  const longSide = dimension(tile.length);
  const shortSide = dimension(tile.width);
  if (!floorWidth || !floorLength || !longSide || !shortSide || longSide < shortSide) return null;

  const tileAcross = direction === "horizontal" ? longSide : shortSide;
  const tileDown = direction === "horizontal" ? shortSide : longSide;
  const columns = axis(floorWidth, tileAcross);
  const rows = axis(floorLength, tileDown);
  const total = columns.total * rows.total;
  const area = (floorWidth / 12) * (floorLength / 12);
  if (!Number.isSafeInteger(total) || total < 1 || !Number.isFinite(area)) return null;

  const layout: FloorLayout = { floorWidthFeet, floorLengthFeet, tileLongSideInches: longSide, tileShortSideInches: shortSide, direction };
  return { layout, floorWidth, floorLength, longSide, shortSide, tileAcross, tileDown, columns, rows, total, area };
}

export function useFloorPlanner() {
  const [floor, setFloor] = useRememberedState("studio.floorPlan.floor", EMPTY);
  const [tile, setTile] = useRememberedState("studio.floorPlan.tile", EMPTY);
  const [direction, setDirection] = useRememberedState<Direction>("studio.floorPlan.direction", "horizontal");
  const plan = calculatePlan(floor, tile, direction);
  const incomplete = !plan && (direction === "vertical" || [floor.width, floor.length, tile.width, tile.length].some(Boolean));

  return { floor, setFloor, tile, setTile, direction, setDirection, plan, incomplete };
}

export function FloorPlanner({ className, tilePhoto, planner }: Readonly<{
  className: string;
  tilePhoto: File | null;
  planner: ReturnType<typeof useFloorPlanner>;
}>) {
  const { floor, setFloor, tile, setTile, direction, setDirection, plan } = planner;
  const group = useId();
  const texture = useObjectUrl(tilePhoto);
  const sidesReversed = dimension(tile.length) > 0 && dimension(tile.length) < dimension(tile.width);

  return (
    <section aria-labelledby={`${group}-title`} className={className}>
      <h3 id={`${group}-title`} className="text-[17px] font-semibold text-ink">Floor planner</h3>
      <div className="mt-4 space-y-4">
        <SizeFields title="Floor size (ft)" widthLabel="Floor width" lengthLabel="Floor length" value={floor} onChange={setFloor} />
        <SizeFields title="Tile size (in)" widthLabel="Tile short side" lengthLabel="Tile long side" value={tile} onChange={setTile} />
        {sidesReversed && <p className="text-sm text-red-700">The long side must be at least as large as the short side.</p>}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Tile direction</legend>
          <div className="grid grid-cols-2 gap-2">
            {directions.map((option) => (
              <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink/10 bg-white/70 px-3 text-sm capitalize text-ink has-[:checked]:border-bronze has-[:checked]:bg-bronze/10">
                <input type="radio" name={`${group}-direction`} value={option} checked={option === direction} onChange={() => setDirection(option)} className="h-4 w-4 accent-[#B08A5B]" />
                {option}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-600">Horizontal runs the long side along the floor width. Vertical runs it along the length.</p>
        </fieldset>
      </div>
      {plan ? (
        <div className="mt-5 space-y-3 border-t border-ink/10 pt-4">
          <div aria-live="polite" aria-atomic="true">
            <p className="text-lg font-semibold text-ink">{number.format(plan.total)} tiles</p>
            <p className="text-sm text-stone-600">
              {number.format(plan.columns.total)} across × {number.format(plan.rows.total)} down · {number.format(plan.area)} sq ft
            </p>
            <p className="mt-1 text-xs text-stone-600">
              {number.format(plan.columns.whole * plan.rows.whole)} full tiles and {number.format(plan.total - plan.columns.whole * plan.rows.whole)} positions with cuts.
              Estimate allows one tile per cut position. Grout, reusable offcuts, and spare tiles are excluded.
            </p>
          </div>
          <details className="rounded-xl border border-ink/10 bg-white/50">
            <summary className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium text-ink">View layout diagram</summary>
            <div className="px-3 pb-3">
              <PlanPreview plan={plan} texture={texture} direction={direction} />
            </div>
          </details>
        </div>
      ) : (
        <p className="mt-4 text-xs text-stone-600">Enter positive floor and tile measurements to preview the layout and estimate tiles.</p>
      )}
    </section>
  );
}

function SizeFields({ title, widthLabel, lengthLabel, value, onChange }: Readonly<{
  title: string;
  widthLabel: string;
  lengthLabel: string;
  value: Dimensions;
  onChange: (value: Dimensions) => void;
}>) {
  const fields = [{ name: "width", label: widthLabel }, { name: "length", label: lengthLabel }] as const;
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(({ name, label }) => (
          <label key={name} className="space-y-1 text-xs text-stone-600">
            <span>{label}</span>
            <input type="number" min="0" step="any" inputMode="decimal" value={value[name]}
              aria-invalid={value[name] !== "" && dimension(value[name]) === 0}
              onChange={(event) => onChange({ ...value, [name]: event.target.value })}
              className="block h-11 w-full rounded-xl border border-ink/15 bg-white/80 px-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-bronze aria-[invalid=true]:border-red-600" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PlanPreview({ plan, texture, direction }: Readonly<{
  plan: NonNullable<ReturnType<typeof calculatePlan>>;
  texture: string | null;
  direction: Direction;
}>) {
  const { floorWidth, floorLength, longSide, shortSide, tileAcross, tileDown } = plan;
  const aspect = floorWidth / floorLength;
  const vertical = direction === "vertical";
  const gridSize = `${100 * (tileAcross / floorWidth)}% ${100 * (tileDown / floorLength)}%`;
  const textureSize = vertical ? `${100 * (longSide / floorLength)}% ${100 * (shortSide / floorWidth)}%` : gridSize;

  return (
    <figure className="rounded-xl bg-ink/[0.035] p-3">
      <figcaption className="mb-2 text-xs font-medium text-stone-600">Top-down floor layout</figcaption>
      <div role="img" aria-label={`${direction} tile layout, ${plan.columns.total} columns by ${plan.rows.total} rows`}
        className="relative mx-auto overflow-hidden rounded-sm border border-ink/30 bg-[#e7d9ca]"
        style={{ width: `min(100%, ${260 * aspect}px)`, aspectRatio: aspect }}>
        {texture && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ backgroundImage: `url("${texture}")`, backgroundSize: textureSize, backgroundPosition: vertical ? "left bottom" : undefined,
              width: vertical ? `${100 / aspect}%` : "100%", height: vertical ? `${100 * aspect}%` : "100%",
              rotate: vertical ? "90deg" : undefined }} />
        )}
        <div className="absolute inset-0" style={{ backgroundSize: gridSize,
          backgroundImage: "linear-gradient(90deg, #46332799 min(1px, 10%), transparent 0), linear-gradient(#46332799 min(1px, 10%), transparent 0)" }} />
      </div>
    </figure>
  );
}
