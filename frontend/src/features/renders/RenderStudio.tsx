"use client";

// The workspace for one template: pick (or upload) the photos, generate, see the result large.
// The network flow lives in useRenderJob; this file is composition only.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAccount } from "@/features/account/hooks";
import { GENERATION_COSTS, RENDER_TEMPLATES, THEME_TEMPLATE_ID, WALL_SELECTION_TEMPLATE_ID } from "@/lib/catalog";
import { cn } from "@/lib/format";
import { useObjectUrl } from "@/lib/hooks";
import { spaceRoomSamples, type RenderSpace } from "@/lib/render-spaces";
import { sampleImages } from "@/lib/samples";
import { FloorPlanner, useFloorPlanner } from "./FloorPlanner";
import { useLeaveWarning, useRememberedState, useRenderJob } from "./hooks";
import { PhotoChooser } from "./PhotoChooser";
import { ResultPanel } from "./ResultPanel";
import { WallPicker } from "./WallPicker";
import type { WallCorners } from "./wallSelection";

const COST = GENERATION_COSTS[0]?.credits ?? 1; // standard renders only, for now
const CARD = "glass scroll-mt-20 rounded-[18px] p-4 sm:p-6";

type Photo = { file: File | null; example?: string };
const EMPTY: Photo = { file: null };

type Props = { templateId: string; space?: RenderSpace; onTemplateChange: (id: string) => void; onBack: () => void };

export function RenderStudio({ templateId, space, onTemplateChange, onBack }: Readonly<Props>) {
  const { account } = useAccount();
  const toast = useToast();
  const { busy, result, error, start } = useRenderJob();
  useLeaveWarning();

  const template = RENDER_TEMPLATES.find((t) => t.id === templateId) ?? RENDER_TEMPLATES[1];
  const category = template.category;
  const theme = template.id === THEME_TEMPLATE_ID;
  const fullFloor = template.id === "floor-full";
  const selectedWallTemplate = template.id === WALL_SELECTION_TEMPLATE_ID;
  const floorPlanner = useFloorPlanner();
  const floorLayout = fullFloor ? floorPlanner.plan?.layout : undefined;
  const incompleteFloor = fullFloor && floorPlanner.incomplete;
  const siblings = RENDER_TEMPLATES.filter((t) => t.category === category);

  // Photo 1 = tile (or site photo); photo 2 = room (or theme reference).
  const [photo1, setPhoto1] = useRememberedState<Photo>("studio.photo1", EMPTY);
  const [photo2, setPhoto2] = useRememberedState<Photo>("studio.photo2", EMPTY);
  const [wall, setWall] = useRememberedState<{ room: File; corners: WallCorners } | null>("studio.wall", null);
  const [tileInRoom, setTileInRoom] = useRememberedState("studio.tileInRoom", false);
  // Photos mean different things in theme mode, so clear them when switching in or out of it.
  const [wasTheme, setWasTheme] = useRememberedState("studio.wasTheme", theme);
  if (wasTheme !== theme) {
    setWasTheme(theme);
    setPhoto1(EMPTY);
    setPhoto2(EMPTY);
    setWall(null);
  }

  const [previousSpace, setPreviousSpace] = useRememberedState<RenderSpace["id"] | undefined>("studio.space", space?.id);
  if (space && previousSpace !== space.id) {
    setPreviousSpace(space.id);
    if (!theme) {
      setPhoto2(EMPTY);
      setWall(null);
    }
  }

  const roomSamples = sampleImages(category, "room");
  const wallCorners = selectedWallTemplate && wall?.room === photo2.file ? wall.corners : undefined;
  const photosReady = Boolean(photo1.file && (!(theme || selectedWallTemplate) || photo2.file));
  const ready = photosReady && !incompleteFloor && (!selectedWallTemplate || Boolean(wallCorners));
  const balance = account?.wallet.balance ?? 0;
  const missing = account ? Math.max(0, COST - balance) : 0;
  const onError = (m: string) => toast(m, "error");

  // Phones: a sticky Generate bar while the main button is off-screen.
  const actions = useRef<HTMLDivElement>(null);
  const output = useRef<HTMLDivElement>(null);
  const [actionsVisible, setActionsVisible] = useState(true);
  useEffect(() => {
    const el = actions.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setActionsVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function generate() {
    if (!account || !ready || !photo1.file) return;
    // On phones the result is below the photos: bring it into view.
    if (typeof window !== "undefined" && !window.matchMedia?.("(min-width: 1024px)")?.matches) {
      output.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
    void start({
      photos: [photo1.file, photo2.file].filter((f): f is File => Boolean(f)),
      templateId: template.id,
      templateName: template.name,
      space: space?.id,
      tileInRoom: theme ? undefined : tileInRoom,
      ...(floorLayout && { floorLayout }),
      ...(wallCorners && { wallCorners }),
    });
  }

  /** "Your selection" thumbnail tapped: scroll to that photo in its section and flash it. */
  function reveal(slot: "photo1" | "photo2") {
    const section = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
    if (!section) return;
    const chosen = section.querySelector<HTMLElement>('[aria-pressed="true"]');
    const target = chosen ?? section;
    // block: centre it on the page; inline: slide it into view inside the phone slider.
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    if (chosen) {
      chosen.classList.remove("flash-pick");
      void chosen.offsetWidth; // restart the animation if tapped twice
      chosen.classList.add("flash-pick");
      window.setTimeout(() => chosen.classList.remove("flash-pick"), 1600);
    }
  }

  let hint: React.ReactNode;
  if (missing > 0) hint = <span className="text-red-600">You need {missing} more image{missing === 1 ? "" : "s"}.</span>;
  else if (incompleteFloor) hint = "Complete the floor and tile measurements to render this layout.";
  else if (!photosReady && selectedWallTemplate) hint = "Choose a tile and a room photo.";
  else if (!photosReady) hint = theme ? "Choose a site photo and a theme reference." : "Choose a tile to start.";
  else if (selectedWallTemplate && !wallCorners) hint = "Highlight the wall you want to tile.";
  else hint = <>Uses <b className="text-ink">{COST}</b> of your {balance} images</>;

  const labels = theme ? (["Site", "Theme"] as const) : (["Tile", "Room"] as const);

  return (
    <div className="pb-24 lg:pb-0">
      {/* Template header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="group mb-4 inline-flex h-10 items-center gap-2 rounded-full border border-ink/15 bg-white/80 pl-2.5 pr-4 text-[14px] font-semibold text-ink shadow-soft transition hover:-translate-y-px hover:border-ink/30 hover:bg-white"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-ivory transition group-hover:-translate-x-0.5">
              <Icon name="chevronLeft" className="h-3.5 w-3.5" />
            </span>
            {space ? "Back to templates" : "Back to spaces"}
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">{template.name}</h2>
            <Badge tone="neutral">{category}</Badge>
            {space && <Badge tone="neutral">{space.name}</Badge>}
          </div>
          <p className="mt-1 text-[14px] text-stone-600">{template.description}</p>
        </div>
        {siblings.length > 1 && (
          <div className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:max-w-full sm:flex-wrap sm:overflow-visible sm:px-0" role="tablist" aria-label={`${category} layouts`}>
            {siblings.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === template.id}
                disabled={busy}
                onClick={() => onTemplateChange(t.id)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition disabled:opacity-60",
                  t.id === template.id ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-white/60 text-ink/70 hover:border-ink/30 hover:text-ink",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Photos: one card per photo */}
        <div className="space-y-5">
          {fullFloor && (
            <FloorPlanner className={CARD} tilePhoto={tileInRoom ? null : photo1.file} planner={floorPlanner} />
          )}
          {theme ? (
            <>
              <div data-tour="tile" data-slot="photo1" className={CARD}>
                <PhotoChooser step={1} title="Site photo" hint="The unfinished space to transform." shape="wide" samples={sampleImages(category, "site")}
                  file={photo1.file} selected={photo1.example} disabled={busy} onChange={(file, example) => setPhoto1({ file, example })} onError={onError} />
              </div>
              <div data-tour="room" data-slot="photo2" className={CARD}>
                <PhotoChooser step={2} title="Theme reference" hint="A finished look to copy." shape="wide" samples={sampleImages(category, "reference")}
                  file={photo2.file} selected={photo2.example} disabled={busy} onChange={(file, example) => setPhoto2({ file, example })} onError={onError} />
              </div>
            </>
          ) : (
            <>
              <div data-tour="tile" data-slot="photo1" className={CARD}>
                <PhotoChooser step={1} title="Tile" hint="Straight-on and evenly lit works best." shape="square" samples={sampleImages(category, "tile")}
                  file={photo1.file} selected={photo1.example} disabled={busy} onChange={(file, example) => setPhoto1({ file, example })} onError={onError} />
              </div>
              <div data-tour="room" data-slot="photo2" className={CARD}>
                <PhotoChooser step={2} title="Room" optional={!selectedWallTemplate}
                  hint={selectedWallTemplate ? "Choose a photo where the wall edges are visible."
                    : space ? "Skip the photo to generate a scene for this space." : "Skip it and we'll use a clean modern room."}
                  shape="wide" samples={space ? spaceRoomSamples(space, roomSamples, category) : roomSamples} file={photo2.file} selected={photo2.example} disabled={busy}
                  onChange={(file, example) => {
                    setPhoto2({ file, example });
                    setWall(null);
                  }} onError={onError} />
                {selectedWallTemplate && photo2.file && (
                  <WallPicker room={photo2.file} corners={wallCorners ?? null} disabled={busy}
                    onChange={(corners) => setWall(corners && photo2.file ? { room: photo2.file, corners } : null)} />
                )}
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-white/50 px-3.5 py-2.5 text-[12.5px] text-stone-600">
                  <input type="checkbox" checked={tileInRoom} disabled={busy} onChange={(e) => setTileInRoom(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#B08A5B]" />
                  <span>
                    <b className="font-medium text-ink">My tile photo shows it already installed</b>
                    <br />
                    We&apos;ll copy just the tile and ignore that room.
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Output */}
        <div ref={output} className="glass scroll-mt-16 rounded-[18px] p-4 sm:p-5 lg:sticky lg:top-6">
          <ResultPanel result={result} error={error} busy={busy} containImage={selectedWallTemplate} />

          <div data-tour="generate">
            <div className="mt-4 border-t border-ink/[0.06] pt-4">
              <p className="mb-2.5 text-[12px] font-medium uppercase tracking-eyebrow text-stone-500">Your selection</p>
              <div className="flex flex-wrap gap-3">
                <Chosen label={labels[0]} file={photo1.file} square={!theme} onClick={() => reveal("photo1")} />
                <Chosen label={labels[1]} file={photo2.file} optional={!theme && !selectedWallTemplate} onClick={() => reveal("photo2")} />
              </div>
              {floorLayout && (
                <p className="mt-3 text-[13px] text-stone-600">
                  <b className="font-medium text-ink">Layout for next render</b>{" "}
                  {floorLayout.floorWidthFeet} × {floorLayout.floorLengthFeet} ft floor ·{" "}
                  {floorLayout.tileLongSideInches} × {floorLayout.tileShortSideInches} in tile ·{" "}
                  <span className="capitalize">{floorLayout.direction}</span>
                </p>
              )}
            </div>
            <div ref={actions} className="mt-4 flex flex-wrap items-center gap-4">
              <p className="order-last w-full text-[13px] text-stone-600 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">{hint}</p>
              {missing > 0 ? (
                <ButtonLink href="/dashboard/billing" variant="bronze" className="ml-auto">
                  Top up
                </ButtonLink>
              ) : (
                <Button variant="bronze" size="lg" onClick={generate} loading={busy} disabled={!ready || !account} className="ml-auto shrink-0">
                  {!busy && <Icon name="sparkle" className="h-4 w-4" />}
                  {busy ? "Rendering…" : "Generate"}
                </Button>
              )}
            </div>
          </div>
          <Link href="/dashboard/renders" className="mt-3 inline-block text-[12.5px] font-medium text-bronze-dark hover:text-ink">
            My renders →
          </Link>
        </div>
      </div>

      {/* Phones/tablets: Generate always within thumb reach. */}
      {!actionsVisible && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-ivory/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lift backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-[1120px] items-center gap-3">
            <MiniThumb file={photo1.file} label={labels[0]} onClick={() => reveal("photo1")} />
            {(theme || selectedWallTemplate || photo2.file) && <MiniThumb file={photo2.file} label={labels[1]} onClick={() => reveal("photo2")} />}
            <p className="min-w-0 flex-1 truncate text-[12.5px] text-stone-600">{hint}</p>
            {missing > 0 ? (
              <ButtonLink href="/dashboard/billing" variant="bronze" className="shrink-0">Top up</ButtonLink>
            ) : (
              <Button variant="bronze" onClick={generate} loading={busy} disabled={!ready || !account} className="shrink-0">
                {!busy && <Icon name="sparkle" className="h-4 w-4" />}
                {busy ? "Rendering…" : "Generate"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Thumbnail of a chosen photo next to the Generate button. Tapping it shows that photo in its section. */
function Chosen({ label, file, square, optional, onClick }: Readonly<{ label: string; file: File | null; square?: boolean; optional?: boolean; onClick: () => void }>) {
  const url = useObjectUrl(file);
  return (
    <button type="button" onClick={onClick} aria-label={url ? `Show the chosen ${label.toLowerCase()}` : `Choose a ${label.toLowerCase()}`} className="group text-left">
      <div
        className={cn(
          "relative h-24 overflow-hidden rounded-xl transition group-hover:-translate-y-0.5",
          square ? "w-24" : "w-32",
          url ? "shadow-soft ring-1 ring-ink/10 group-hover:ring-bronze/60" : "grid place-items-center border-2 border-dashed border-ink/15 bg-white/50 group-hover:border-bronze/60",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Chosen ${label.toLowerCase()}`} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-[11.5px] text-stone-500">{optional ? "Optional" : "Not chosen"}</span>
        )}
      </div>
      <p className="mt-1.5 text-[12px] font-medium text-ink/70 group-hover:text-ink">{label}</p>
    </button>
  );
}

/** Tiny thumbnail for the phone Generate bar. */
function MiniThumb({ file, label, onClick }: Readonly<{ file: File | null; label: string; onClick: () => void }>) {
  const url = useObjectUrl(file);
  return (
    <button type="button" onClick={onClick} aria-label={url ? `Show the chosen ${label.toLowerCase()}` : `Choose a ${label.toLowerCase()}`} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/70 ring-1 ring-ink/10">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Chosen ${label.toLowerCase()}`} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="grid h-full place-items-center text-[9.5px] text-stone-500">{label}</span>
      )}
    </button>
  );
}
