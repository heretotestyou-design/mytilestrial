"use client";

// One "Add your photo" row (camera or upload) above the example photos. One choice per chooser.
// Examples: phones get a swipeable slider (the next card peeks in); tablets and up a grid.
import { useEffect, useRef, useState } from "react";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/format";
import { useObjectUrl } from "@/lib/hooks";
import { sampleToFile, type SampleImage } from "@/lib/samples";
import { CameraCapture } from "./CameraCapture";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "./constants";

type Props = {
  title: string;
  hint: string;
  samples: SampleImage[];
  /** square for tiles, wide for rooms and sites. */
  shape: "square" | "wide";
  file: File | null;
  /** src of the example in use; undefined when the file is the user's own photo. */
  selected?: string;
  optional?: boolean;
  /** Step number shown before the title (turns into a check once a photo is chosen). */
  step?: number;
  disabled?: boolean;
  onChange: (file: File | null, example?: string) => void;
  onError: (message: string) => void;
};

export function PhotoChooser({ title, hint, samples, shape, file, selected, optional, step, disabled, onChange, onError }: Readonly<Props>) {
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const addCard = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const ownFile = file && !selected ? file : null;
  const ownPreview = useObjectUrl(ownFile);
  const shown = samples.filter((s) => missing[s.src] !== true);
  const noun = title.toLowerCase();

  // Close the camera/upload menu on outside tap or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: PointerEvent) => !addCard.current?.contains(e.target as Node) && setMenuOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  function accept(f: File | undefined) {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) return onError("Use a JPG, PNG or WebP image.");
    if (f.size > MAX_UPLOAD_BYTES) return onError("Images must be 10 MB or smaller.");
    onChange(f);
  }

  /** Phones/tablets: the native camera app (better photos). Computers: the in-app camera. */
  function openCamera() {
    setMenuOpen(false);
    const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
    if (touch) cameraInput.current?.click();
    else setCameraOpen(true);
  }

  function openUpload() {
    setMenuOpen(false);
    input.current?.click();
  }

  async function pick(s: SampleImage) {
    // Tapping the chosen example again clears an optional slot.
    if (s.src === selected) {
      if (optional) onChange(null);
      return;
    }
    setLoading(s.src);
    try {
      onChange(await sampleToFile(s), s.src);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't load that example.");
    } finally {
      setLoading(null);
    }
  }

  const cell = shape === "square" ? "aspect-square" : "aspect-[4/3]";
  // Phone: fixed-width slides with the next one peeking. sm+: grid cells.
  const slide = cn("shrink-0 snap-start sm:w-auto", shape === "square" ? "w-[40%]" : "w-[78%]");
  const cols = shape === "square" ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            {step !== undefined && (
              <span
                aria-hidden
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold transition",
                  file ? "bg-bronze text-white" : "bg-ink text-ivory",
                )}
              >
                {file ? <Icon name="check" className="h-3.5 w-3.5" /> : step}
              </span>
            )}
            {title}
            {optional && <span className="text-[12px] font-normal text-stone-500">optional</span>}
          </h3>
          <p className={cn("text-[12.5px] text-stone-600", step !== undefined && "mt-0.5 pl-8")}>{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1 text-[11.5px] text-stone-500 sm:hidden" aria-hidden>
            Swipe <Icon name="chevronRight" className="h-3 w-3" />
          </span>
          {file && (
            <button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-[12.5px] font-medium text-stone-600 hover:text-ink disabled:opacity-50">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Add your photo: its own row above the examples; one tap asks camera or upload. */}
      <div
        ref={addCard}
        className={cn(
          "relative mb-3 h-[76px] overflow-hidden rounded-2xl transition",
          ownPreview ? "bg-white/80 ring-[3px] ring-bronze" : "border-2 border-dashed",
          !ownPreview && (over ? "border-bronze bg-bronze/10" : "border-ink/15 bg-white/60 hover:border-bronze/60 hover:bg-white/80"),
          disabled && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) accept(e.dataTransfer.files[0]);
        }}
      >
        <input ref={input} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }} />

        <button
          type="button"
          disabled={disabled}
          aria-label={ownPreview ? `Replace your ${noun}` : `Add your own ${noun}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-pressed={Boolean(ownFile)}
          onClick={() => setMenuOpen((o) => !o)}
          className="group absolute inset-0 flex items-center gap-3.5 px-3.5 text-left"
        >
          {ownPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ownPreview} alt={`Your ${noun}`} className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover shadow-soft" />
          ) : (
            <span className="flex shrink-0 -space-x-1.5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-ivory shadow-soft ring-2 ring-white transition group-hover:-translate-x-0.5">
                <Icon name="camera" className="h-[18px] w-[18px]" />
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-bronze-dark shadow-soft ring-2 ring-white transition group-hover:translate-x-0.5">
                <Icon name="upload" className="h-[18px] w-[18px]" />
              </span>
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{ownPreview ? `Your ${noun}` : `Add your ${noun}`}</span>
            <span className="block truncate text-[12px] text-stone-500">{ownPreview ? "In use · tap to change" : "Take a photo or upload one"}</span>
          </span>
          {ownPreview ? (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-bronze text-white shadow-soft">
              <Icon name="check" className="h-3.5 w-3.5" />
            </span>
          ) : (
            <Icon name="plus" className="h-5 w-5 shrink-0 text-stone-500 transition group-hover:text-ink" />
          )}
        </button>

        {menuOpen && (
          <div role="menu" aria-label={`Add your ${noun}`} className="absolute inset-0 z-10 grid grid-cols-2 gap-2 bg-white/95 p-2 backdrop-blur-sm">
            <button role="menuitem" type="button" onClick={openCamera} className="flex items-center justify-center gap-2 rounded-xl bg-ink px-3 text-[13.5px] font-semibold text-ivory transition active:scale-[0.98]">
              <Icon name="camera" className="h-4 w-4 shrink-0" /> Camera
            </button>
            <button role="menuitem" type="button" onClick={openUpload} className="flex items-center justify-center gap-2 rounded-xl border border-ink/15 bg-white px-3 text-[13.5px] font-semibold text-ink transition active:scale-[0.98]">
              <Icon name="upload" className="h-4 w-4 shrink-0 text-bronze-dark" /> Upload
            </button>
          </div>
        )}
      </div>

      {/* Examples: their own row (phone slider, grid from sm). */}
      <div
        className={cn(
          // Phone slider bleeds to the card edge (the card has p-4) and snaps per photo.
          "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1",
          "sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0",
          cols,
        )}
      >

        {shown.map((s) => {
          const active = s.src === selected;
          return (
            <button
              key={s.src}
              type="button"
              aria-label={`Use ${s.label}`}
              aria-pressed={active}
              disabled={disabled || loading !== null}
              onClick={() => pick(s)}
              className={cn(
                "group relative overflow-hidden rounded-2xl transition disabled:cursor-not-allowed",
                slide,
                active ? "ring-[3px] ring-bronze" : "ring-1 ring-ink/[0.08] sm:hover:-translate-y-0.5 sm:hover:shadow-lift sm:hover:ring-bronze/50",
              )}
            >
              <FallbackImage
                src={s.src}
                alt={s.label}
                className={cn(cell, "transition-transform duration-500 sm:group-hover:scale-[1.04]")}
                onStatus={(ok) => setMissing((m) => (m[s.src] === !ok ? m : { ...m, [s.src]: !ok }))}
              />
              {active && <Check />}
              {loading === s.src && <span className="absolute inset-0 grid place-items-center bg-white/60 text-[12px] font-medium">Loading…</span>}
            </button>
          );
        })}
      </div>
      <CameraCapture open={cameraOpen} title={`Take a photo · ${title}`} onClose={() => setCameraOpen(false)} onCapture={(f) => accept(f)} />
    </section>
  );
}

function Check() {
  return (
    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-bronze text-white shadow-soft">
      <Icon name="check" className="h-3.5 w-3.5" />
    </span>
  );
}
