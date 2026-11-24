"use client";

import { useId, useRef } from "react";
import { useObjectUrl } from "@/lib/hooks";
import { moveWallCorner, wallAt, wallPresets, type WallCorners } from "./wallSelection";

const CORNERS = ["Top left", "Top right", "Bottom right", "Bottom left"];
const ARROWS: Record<string, readonly [number, number] | undefined> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export function WallPicker({ room, corners, disabled, onChange }: Readonly<{
  room: File;
  corners: WallCorners | null;
  disabled: boolean;
  onChange: (next: WallCorners | null) => void;
}>) {
  const photo = useRef<HTMLImageElement>(null);
  const url = useObjectUrl(room);
  const title = useId();
  const points = corners?.map(({ x, y }) => `${x * 100}% ${y * 100}%`).join(", ");

  function position(clientX: number, clientY: number) {
    const bounds = photo.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return null;
    return { x: (clientX - bounds.left) / bounds.width, y: (clientY - bounds.top) / bounds.height };
  }

  if (!url) return null;
  return (
    <section aria-labelledby={title} className="mt-5 border-t border-ink/10 pt-4">
      <h3 id={title} className="text-[15px] font-semibold text-ink">Select the wall to tile</h3>
      <p className="mt-1 text-sm text-stone-600">Tap the wall or choose a starting side. Drag the four corners to match its edges.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Object.entries(wallPresets).map(([name, preset]) => (
          <button key={name} type="button" disabled={disabled} onClick={() => onChange(preset)}
            className="min-h-9 rounded-full border border-ink/15 bg-white/70 px-3 text-sm font-medium text-ink hover:border-bronze disabled:opacity-50">
            {name} wall
          </button>
        ))}
        {corners && (
          <button type="button" disabled={disabled} onClick={() => onChange(null)}
            className="ml-auto min-h-9 px-2 text-sm font-medium text-stone-600 hover:text-ink disabled:opacity-50">
            Clear selection
          </button>
        )}
      </div>
      <div className="mt-3 rounded-xl bg-ink/[0.04] p-2">
        <div className="relative mx-auto w-fit max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={photo} src={url} alt="Room photo for wall selection" draggable={false}
            className="block h-auto max-h-[55vh] w-auto max-w-full rounded-lg bg-white data-[active=true]:cursor-crosshair"
            data-active={!disabled}
            onClick={(event) => {
              if (disabled) return;
              const point = position(event.clientX, event.clientY);
              if (point) onChange(wallAt(point.x));
            }} />
          {corners && (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-lg bg-amber-400/30"
                style={{ clipPath: `polygon(${points})` }} />
              {corners.map(({ x, y }, i) => (
                <button key={CORNERS[i]} type="button" disabled={disabled} aria-label={`${CORNERS[i]} wall corner`}
                  className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:pointer-events-none"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                  onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
                  onPointerMove={(event) => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    const point = position(event.clientX, event.clientY);
                    if (point) onChange(moveWallCorner(corners, i, point.x, point.y));
                  }}
                  onKeyDown={(event) => {
                    const offset = ARROWS[event.key];
                    if (!offset) return;
                    event.preventDefault();
                    const step = event.shiftKey ? 0.05 : 0.01;
                    onChange(moveWallCorner(corners, i, x + step * offset[0], y + step * offset[1]));
                  }}>
                  <span aria-hidden className="h-4 w-4 rounded-full border-2 border-white bg-amber-600 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
                </button>
              ))}
            </>
          )}
        </div>
      </div>
      <p aria-live="polite" className="mt-2 text-xs text-stone-600">
        {corners ? "The highlighted area will be tiled." : "Select one wall before generating."}
      </p>
    </section>
  );
}
