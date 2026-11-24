"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { Icon } from "@/components/ui/Icon";
import { RENDER_TEMPLATES, TEMPLATE_CATEGORIES, THEME_TEMPLATE_ID, WALL_SELECTION_TEMPLATE_ID } from "@/lib/catalog";
import { cn } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { templatePreview } from "@/lib/samples";
import { CATEGORY_ICON, type TemplateCategory } from "./constants";
import { TemplatePreview } from "./TemplatePreview";

type Filter = "All" | TemplateCategory;
const FILTERS: Filter[] = ["All", ...TEMPLATE_CATEGORIES];

/** Browse every layout by category; "Use template" opens it in the studio. */
export function TemplatesGallery({ selectedId, onUse }: Readonly<{ selectedId: string; onUse: (id: string) => void }>) {
  const [filter, setFilter] = useState<Filter>("All");
  const shown = filter === "All" ? RENDER_TEMPLATES : RENDER_TEMPLATES.filter((t) => t.category === filter);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Template categories">
        {FILTERS.map((f) => {
          const count = f === "All" ? RENDER_TEMPLATES.length : RENDER_TEMPLATES.filter((t) => t.category === f).length;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                filter === f ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-white/60 text-ink/70 hover:border-ink/30 hover:text-ink",
              )}
            >
              {f !== "All" && <Icon name={CATEGORY_ICON[f]} className="h-3.5 w-3.5" />}
              {f}
              <span className={cn("tabular-nums", filter === f ? "text-ivory/60" : "text-stone-500")}>{count}</span>
            </button>
          );
        })}
      </div>

      <motion.ul layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {shown.map((t, i) => {
            const selected = t.id === selectedId;
            return (
              <motion.li
                layout
                key={t.id}
                data-tour={selected ? "template" : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03, ease: EASE_OUT }}
              >
                <button
                  type="button"
                  onClick={() => onUse(t.id)}
                  className={cn(
                    "glass group block w-full overflow-hidden rounded-[18px] text-left transition hover:-translate-y-0.5 hover:shadow-lift",
                    selected && "ring-2 ring-bronze",
                  )}
                >
                  {/* Animated diagram of what gets tiled; hovering shows a real AI result. */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#F7F3EE]">
                    <TemplatePreview id={t.id} />
                    <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <FallbackImage src={templatePreview(t.id)} alt={`${t.name}: example result`} icon={CATEGORY_ICON[t.category]} className="h-full w-full" />
                      <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-ivory backdrop-blur">Real example</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-semibold">{t.name}</p>
                      <Badge tone="neutral">{t.category}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-stone-600">{t.description}</p>
                    <p className="mt-1 text-[12px] text-stone-500">
                      {t.id === THEME_TEMPLATE_ID ? "Needs a site photo and a reference photo"
                        : t.id === WALL_SELECTION_TEMPLATE_ID ? "Needs a tile photo and a room photo"
                          : "Needs a tile photo · room photo optional"}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-bronze-dark transition group-hover:gap-2.5">
                      Use this template <Icon name="share" className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}
