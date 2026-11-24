"use client";

// An <img> with a loader while it downloads, and a tile-pattern placeholder if the file
// doesn't exist (yet) or fails.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "./Icon";

type Props = {
  src: string;
  alt: string;
  className?: string;
  /** Placeholder icon and caption, e.g. the file name to add. */
  icon?: IconName;
  caption?: string;
  onStatus?: (ok: boolean) => void;
};

export function FallbackImage({ src, alt, className, icon = "image", caption, onStatus }: Readonly<Props>) {
  const img = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const status = useRef(onStatus);
  status.current = onStatus;

  useEffect(() => {
    // A cached image can finish before React attaches onLoad (e.g. during hydration),
    // so check the element itself instead of waiting for an event that already fired.
    const el = img.current;
    if (el?.complete) {
      const ok = el.naturalWidth > 0;
      setState(ok ? "ok" : "missing");
      status.current?.(ok);
    } else {
      setState("loading");
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-[#F1EADF]", className)} aria-busy={state === "loading"}>
      {state !== "ok" && (
        <div className="absolute inset-0 grid place-items-center">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(45deg,rgba(176,138,91,0.14)_25%,transparent_25%,transparent_75%,rgba(176,138,91,0.14)_75%),linear-gradient(45deg,rgba(176,138,91,0.14)_25%,transparent_25%,transparent_75%,rgba(176,138,91,0.14)_75%)] bg-[size:22px_22px] bg-[position:0_0,11px_11px]"
          />
          {state === "loading" && (
            <>
              <div
                aria-hidden
                className="absolute inset-0 -translate-x-full animate-[skeleton_1.4s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]"
              />
              <output aria-label="Loading image" className="relative block h-5 w-5 animate-spin rounded-full border-2 border-bronze/25 border-t-bronze-dark" />
            </>
          )}
          {state === "missing" && (
            <div className="relative px-2 text-center">
              <Icon name={icon} className="mx-auto h-5 w-5 text-bronze-dark/70" />
              {caption && <p className="mt-1 truncate text-[10.5px] font-medium text-stone-500">{caption}</p>}
            </div>
          )}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          setState("ok");
          onStatus?.(true);
        }}
        onError={() => {
          setState("missing");
          onStatus?.(false);
        }}
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", state === "ok" ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
