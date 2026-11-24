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
    if (id) setTemplateId(id);
    setOpen(id !== null);
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

      {/* Both stay mounted so chosen photos and a running render survive going back. */}
      <motion.div {...rise(0)} hidden={open}>
        {space ? (
          <section aria-labelledby="layouts-heading">
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Button variant="outline" size="sm" onClick={() => show(null, undefined)}>
                <Icon name="chevronLeft" className="h-4 w-4" /> All spaces
              </Button>
              <h2 id="layouts-heading" className="font-serif text-2xl font-semibold text-ink">
                {space.name} layouts
              </h2>
            </div>
            <TemplatesGallery key={space.id} selectedId={templateId} onUse={(id) => show(id, space)} />
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
