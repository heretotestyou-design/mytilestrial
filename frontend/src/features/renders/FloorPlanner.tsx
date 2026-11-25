"use client";

import { useId } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAccount } from "@/features/account/hooks";
import { GENERATION_COSTS } from "@/lib/catalog";
import { FLOOR_PLANNER_TILES, type FloorTileFinish } from "@/lib/samples";
import { ResultPanel } from "./ResultPanel";
import type { FloorLayout } from "@/lib/types";
import { useLeaveWarning, useRememberedState, useRenderJob } from "./hooks";

type Direction = FloorLayout["direction"];
type Dimensions = { width: string; length: string };
const DEFAULT_FLOOR: Dimensions = { width: "12", length: "10" };
const DEFAULT_TILE: Dimensions = { width: "12", length: "24" };
const COST = GENERATION_COSTS[0]?.credits ?? 1;
const PANEL = "glass rounded-[18px] p-4 sm:p-6";
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
  return { layout, floorWidth, floorLength, tileAcross, tileDown, columns, rows, total, area };
}

export function FloorPlanner() {
  const { account } = useAccount();
  const { busy, rendering, result, error, floorPreview, start } = useRenderJob("floor-preview");
  useLeaveWarning();

  const [floor, setFloor] = useRememberedState("studio.floorPlan.floor", DEFAULT_FLOOR);
  const [tile, setTile] = useRememberedState("studio.floorPlan.tile", DEFAULT_TILE);
  const [direction, setDirection] = useRememberedState<Direction>("studio.floorPlan.direction", "horizontal");
  const [finish, setFinish] = useRememberedState<FloorTileFinish>("studio.floorPlan.finish", FLOOR_PLANNER_TILES[0].id);
  const selectedTile = FLOOR_PLANNER_TILES.find((option) => option.id === finish) ?? FLOOR_PLANNER_TILES[0];
  const plan = calculatePlan(floor, tile, direction);
  const previewLayout = plan && { ...plan.layout, tileFinish: selectedTile.id };
  const group = useId();
  const balance = account?.wallet.balance ?? 0;
  const canBuy = account && balance < COST;
  const changesPending = result && JSON.stringify(previewLayout) !== JSON.stringify(floorPreview);
  const sidesReversed = dimension(tile.length) > 0 && dimension(tile.length) < dimension(tile.width);

  return (
    <>
      <PageHeader title="Floor planner" description="Estimate your tiles and generate a room preview from the layout." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby={`${group}-title`} className={PANEL}>
          <h2 id={`${group}-title`} className="text-[17px] font-semibold text-ink">Tile layout</h2>
          {plan ? (
            <div className="mt-4 space-y-3">
              <div aria-live="polite" aria-atomic="true">
                <p className="text-lg font-semibold text-ink">{number.format(plan.total)} tiles</p>
                <p className="text-sm text-stone-600">
                  {number.format(plan.columns.total)} across by {number.format(plan.rows.total)} down, {number.format(plan.area)} sq ft
                </p>
                <p className="mt-1 text-xs text-stone-600">
                  {number.format(plan.columns.whole * plan.rows.whole)} full tiles and {number.format(plan.total - plan.columns.whole * plan.rows.whole)} positions with cuts.
                  Estimate allows one tile per cut position. Grout, reusable offcuts, and spare tiles are excluded.
                </p>
              </div>
              <PlanPreview plan={plan} direction={direction} tileSrc={selectedTile.src} />
            </div>
          ) : (
            <p role="status" className="mt-4 text-sm text-stone-600">Enter valid floor and tile measurements to calculate the layout.</p>
          )}
          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-semibold text-ink">Tile finish</legend>
            <div className="grid grid-cols-3 gap-2">
              {FLOOR_PLANNER_TILES.map((option) => (
                <label key={option.id} className="relative block cursor-pointer rounded-xl border border-ink/10 bg-white/70 p-1.5 has-[:checked]:border-bronze has-[:checked]:bg-bronze/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze">
                  <input type="radio" name={`${group}-finish`} value={option.id} checked={selectedTile.id === option.id}
                    onChange={() => setFinish(option.id)} className="sr-only" />
                  <span aria-hidden="true" className="block h-12 rounded-lg bg-stone-200 bg-cover bg-center"
                    style={{ backgroundImage: `url("${option.src}")` }} />
                  <span className="mt-1.5 block text-xs font-medium text-ink">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <details className="mt-4 rounded-xl border border-ink/10 bg-white/50">
            <summary className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium text-ink">Adjust measurements</summary>
            <div className="space-y-4 px-3 pb-3">
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
                <p className="mt-2 text-xs text-stone-600">Horizontal runs the long side across the width. Vertical runs it along the length.</p>
              </fieldset>
            </div>
          </details>
        </section>
        <section aria-labelledby={`${group}-preview`} className={PANEL}>
          <h2 id={`${group}-preview`} className="mb-3 text-[17px] font-semibold text-ink">Room preview</h2>
          <ResultPanel result={result} error={error} busy={rendering} containImage emptyHint="Generate a room from your tile layout." />
          {changesPending && <p role="status" className="mt-3 text-sm text-stone-600">This preview shows the previous layout or tile finish. Generate again to apply your changes.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="flex-1 text-xs text-stone-600">The room image is an illustration. Use the tile diagram for exact counts.</p>
            {canBuy ? (
              <ButtonLink href="/dashboard/billing" variant="bronze">Top up</ButtonLink>
            ) : (
              <Button variant="bronze" loading={rendering} disabled={!account || !previewLayout || busy}
                onClick={() => previewLayout && void start({ templateName: "Floor planner", floorPreview: previewLayout })}>
                {!rendering && <Icon name="sparkle" className="h-4 w-4" />}
                {rendering ? "Generating" : `Generate preview (${COST} image)`}
              </Button>
            )}
          </div>
        </section>
      </div>
    </>
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

function PlanPreview({ plan, direction, tileSrc }: Readonly<{
  plan: NonNullable<ReturnType<typeof calculatePlan>>;
  direction: Direction;
  tileSrc: string;
}>) {
  const { floorWidth, floorLength, tileAcross, tileDown } = plan;
  const aspect = floorWidth / floorLength;
  const gridSize = `${100 * (tileAcross / floorWidth)}% ${100 * (tileDown / floorLength)}%`;
  const { floorWidthFeet, floorLengthFeet, tileLongSideInches, tileShortSideInches } = plan.layout;

  return (
    <figure className="rounded-xl bg-ink/[0.035] p-3">
      <figcaption className="mb-2 text-xs font-medium text-stone-600">
        {floorWidthFeet} ft by {floorLengthFeet} ft floor, {tileLongSideInches} in by {tileShortSideInches} in tiles
      </figcaption>
      <div role="img" aria-label={`${direction} tile layout, ${plan.columns.total} columns by ${plan.rows.total} rows`}
        className="relative mx-auto overflow-hidden rounded-sm border border-ink/30 bg-[#dbcbbb]"
        style={{ width: `min(100%, ${260 * aspect}px)`, aspectRatio: aspect, backgroundImage: `url("${tileSrc}")`, backgroundSize: gridSize }}>
        <div className="absolute inset-0" style={{ backgroundSize: gridSize,
          backgroundImage: "linear-gradient(90deg, #e7d9ca min(1px, 10%), transparent 0), linear-gradient(#e7d9ca min(1px, 10%), transparent 0)" }} />
      </div>
    </figure>
  );
}
