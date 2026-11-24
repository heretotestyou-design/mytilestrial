"use client";

// Hero showcase: one real room, re-tiled by the AI in every layout × tile combination
// (pre-rendered in /public/hero). All images preload after the page settles, so
// switching is instant and feels live.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

const LAYOUTS = [
  { id: "grid", label: "Grid" },
  { id: "brick", label: "Brick" },
  { id: "herringbone", label: "Herringbone" },
  { id: "checker", label: "Checker" },
] as const;

const TILES = [
  { id: "marble", label: "White marble", swatch: "/samples/floor/tiles/01.jpg" },
  { id: "travertine", label: "Travertine", swatch: "/samples/floor/tiles/03.jpg" },
  { id: "black", label: "Black marble", swatch: "/samples/floor/tiles/06.jpg" },
  { id: "sage", label: "Sage zellige", swatch: "/samples/walls/tiles/02.jpg" },
  { id: "terracotta", label: "Terracotta", swatch: "/samples/walls/tiles/05.jpg" },
] as const;

type LayoutId = (typeof LAYOUTS)[number]["id"];
type TileId = (typeof TILES)[number]["id"];

const src = (layout: LayoutId, tile: TileId) => `/hero/${layout}-${tile}.webp`;

export function TileStudio() {
  const [layout, setLayout] = useState<LayoutId>("herringbone");
  const [tile, setTile] = useState<TileId>("marble");
  // What's on screen: only switches once the next image is decoded, so it never flashes.
  const [shown, setShown] = useState(src("herringbone", "marble"));
  const [pending, setPending] = useState(false);
  const ready = useRef(new Set<string>());

  // Warm every combination in the background once the page is idle.
  useEffect(() => {
    const warm = () => {
      for (const l of LAYOUTS) for (const t of TILES) {
        const url = src(l.id, t.id);
        const img = new Image();
        img.src = url;
        img.decode().then(() => ready.current.add(url)).catch(() => {});
      }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(warm);
    else setTimeout(warm, 1200);
  }, []);

  // Swap to the chosen combination as soon as it's decoded.
  useEffect(() => {
    const next = src(layout, tile);
    if (next === shown) return;
    if (ready.current.has(next)) {
      setShown(next);
      return;
    }
    let cancelled = false;
    setPending(true);
    const img = new Image();
    img.src = next;
    void img
      .decode()
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        ready.current.add(next);
        setShown(next);
        setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [layout, tile, shown]);

  const tileLabel = TILES.find((t) => t.id === tile)!.label;
  const layoutLabel = LAYOUTS.find((l) => l.id === layout)!.label;

  return (
    <div className="relative">
      {/* Room */}
      <div className="relative aspect-[3/2] overflow-hidden rounded-[28px] border border-white/10 bg-ink-800 shadow-lift">
        <AnimatePresence initial={false}>
          <motion.img
            key={shown}
            src={shown}
            alt={`A living room with a ${tileLabel.toLowerCase()} floor in a ${layoutLabel.toLowerCase()} layout`}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            draggable={false}
          />
        </AnimatePresence>

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-medium tracking-wide text-ivory backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Real AI render
        </div>
        {pending && (
          <span aria-label="Loading" className="absolute right-4 top-4 h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      {/* Controls */}
      <div className="relative z-10 mx-3 -mt-10 rounded-2xl border border-white/10 bg-ink-800/80 p-4 text-ivory shadow-lift backdrop-blur-xl sm:mx-6">
        <div className="flex flex-col gap-3.5">
          <Group label="Layout">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={layout === l.id}
                onClick={() => setLayout(l.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] transition",
                  layout === l.id ? "bg-ivory text-ink" : "text-ivory/70 hover:bg-white/10 hover:text-ivory",
                )}
              >
                {l.label}
              </button>
            ))}
          </Group>
          <Group label="Tile">
            {TILES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-pressed={tile === t.id}
                onClick={() => setTile(t.id)}
                className={cn(
                  "h-8 w-8 rounded-lg border bg-cover bg-center transition",
                  tile === t.id ? "scale-110 border-ivory ring-2 ring-bronze/70" : "border-white/20 hover:scale-105",
                )}
                style={{ backgroundImage: `url(${t.swatch})` }}
              />
            ))}
            <span className="ml-1 hidden text-[12px] text-ivory/60 sm:inline">{tileLabel}</span>
          </Group>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
      <span className="w-14 text-[10px] uppercase tracking-eyebrow text-ivory/40">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
