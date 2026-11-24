"use client";

import { FallbackImage } from "@/components/ui/FallbackImage";
import { Icon } from "@/components/ui/Icon";
import { RENDER_SPACES, type RenderSpace } from "@/lib/render-spaces";

export function SpacePicker({ onPick }: Readonly<{ onPick: (space: RenderSpace) => void }>) {
  return (
    <section aria-labelledby="space-heading">
      <h2 id="space-heading" className="mb-4 font-serif text-2xl font-semibold text-ink">
        Choose a space
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {RENDER_SPACES.map((space, index) => (
          <li key={space.id}>
            <button
              type="button"
              aria-label={space.name}
              data-tour={index === 0 ? "space" : undefined}
              onClick={() => onPick(space)}
              className="glass group block w-full overflow-hidden rounded-[18px] text-left transition hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze"
            >
              <FallbackImage src={`/samples/${space.examples[0]}.jpg`} alt="" icon="home" className="aspect-[4/3] w-full sm:aspect-[16/10]" />
              <span className="flex items-center justify-between gap-1 px-3 py-3 text-sm font-semibold text-ink sm:px-4 sm:py-4 sm:text-base">
                {space.name}
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-bronze-dark transition group-hover:translate-x-0.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
