"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAccount } from "@/features/account/hooks";
import { GuidedTour } from "@/features/onboarding/GuidedTour";
import { hasSeenTour, markTourSeen, TOUR_STEPS } from "@/features/onboarding/tour";
import { clearStudioPreview, useRenderJob } from "@/features/renders/hooks";
import { RenderStudio } from "@/features/renders/RenderStudio";
import { SpacePicker } from "@/features/renders/SpacePicker";
import { TemplatesGallery } from "@/features/renders/TemplatesGallery";
import { RENDER_TEMPLATES } from "@/lib/catalog";
import { greeting } from "@/lib/hooks";
import { rise } from "@/lib/motion";
import { findRenderSpace, RENDER_SPACES, type RenderSpace } from "@/lib/render-spaces";

const DEFAULT_TEMPLATE = "floor-full";
const isTemplate = (id: string | null): id is string => RENDER_TEMPLATES.some((t) => t.id === id);

/** Home: choose a space, browse its templates, then open the workspace. */
export function OverviewView() {
  const { account, error } = useAccount();
  const { busy } = useRenderJob();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ?template=<id> opens a workspace; the older ?tab=create opens the default one.
  const initial = params.get("template");
  const [templateId, setTemplateId] = useState(isTemplate(initial) ? initial : DEFAULT_TEMPLATE);
  const [open, setOpen] = useState(isTemplate(initial) || params.get("tab") === "create");
  const [space, setSpace] = useState(() => findRenderSpace(params.get("space")));
  const firstName = account?.profile.full_name?.split(" ")[0];

  function show(id: string | null, nextSpace: RenderSpace | undefined) {
    const nextOpen = id !== null;
    if (open !== nextOpen || (nextOpen && (id !== templateId || nextSpace?.id !== space?.id))) clearStudioPreview();
    if (id) setTemplateId(id);
    setOpen(nextOpen);
    setSpace(nextSpace);
    const query = new URLSearchParams();
    if (nextSpace) query.set("space", nextSpace.id);
    if (id) query.set("template", id);
    router.replace(query.size ? `${pathname}?${query}` : pathname, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const userId = account?.profile.id;
  const [tourStep, setTourStep] = useState<number | null>(null);
  useEffect(() => {
    if (userId && !open && !space && !hasSeenTour(userId)) setTourStep(0);
    // Only prompt on entry for this account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function goToStep(n: number) {
    const screen = TOUR_STEPS[n]?.screen;
    if (screen === "spaces" && (open || space)) show(null, undefined);
    if (screen === "gallery" && (open || !space)) show(null, space ?? RENDER_SPACES[0]);
    if (screen === "studio" && !open) show(templateId, space ?? RENDER_SPACES[0]);
    setTourStep(n);
  }

  function endTour() {
    if (userId) markTourSeen(userId);
    setTourStep(null);
  }

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description={open ? "Choose your photos, then generate." : space ? "Pick a layout to see your tile in this space." : "Start with the room you want to visualize."}
      >
        <Button variant="outline" size="sm" onClick={() => goToStep(0)}>
          <Icon name="info" className="h-4 w-4" /> How it works
        </Button>
      </PageHeader>

      {error && <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p>}

      {space && (
        <div className="mb-5 flex items-center gap-2 md:hidden">
          <Button
            variant="outline"
            className="shrink-0 !pl-2.5 !pr-4"
            aria-label={open ? "Back to templates" : "Back to all spaces"}
            onClick={() => show(null, open ? space : undefined)}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black text-white">
              <Icon name="arrowLeftSolid" className="h-3.5 w-3.5 fill-current stroke-none" />
            </span>
            {open ? "Templates" : "All spaces"}
          </Button>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Space</span>
            <select
              value={space.id}
              disabled={busy}
              onChange={(event) => {
                const next = findRenderSpace(event.target.value);
                if (next) show(open ? templateId : null, next);
              }}
              className="h-11 w-full appearance-none rounded-full border border-ink/10 bg-white/80 pl-3.5 pr-8 text-base font-semibold text-ink shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-bronze disabled:opacity-60"
            >
              {RENDER_SPACES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <Icon name="chevronRight" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-bronze-dark" />
          </label>
        </div>
      )}

      {/* Both stay mounted so the gallery filter and photo selections survive going back. */}
      <motion.div {...rise(0)} hidden={open}>
        {space ? (
          <section aria-labelledby="layouts-heading">
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => show(null, undefined)}>
                <Icon name="chevronLeft" className="h-4 w-4" /> All spaces
              </Button>
              <h2 id="layouts-heading" className="font-serif text-2xl font-semibold text-ink">
                {space.name} layouts
              </h2>
            </div>
            <TemplatesGallery key={space.id} space={space} selectedId={templateId} onUse={(id) => show(id, space)} />
          </section>
        ) : (
          <SpacePicker onPick={(next) => show(null, next)} />
        )}
      </motion.div>
      <div hidden={!open}>
        <RenderStudio templateId={templateId} space={space} onTemplateChange={(id) => show(id, space)} onBack={() => show(null, space)} />
      </div>

      {tourStep !== null && <GuidedTour steps={TOUR_STEPS} step={tourStep} onStep={goToStep} onClose={endTour} />}
    </>
  );
}
