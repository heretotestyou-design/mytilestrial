import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuidedTour, type TourStep } from "./GuidedTour";
import { hasSeenTour, markTourSeen, TOUR_STEPS } from "./tour";

const steps: TourStep[] = [
  { target: "a", title: "Choose a template", body: "Tap one." },
  { target: "b", title: "Pick your tile", body: "Tap a tile." },
  { target: "c", title: "Press Generate", body: "Go." },
];

function setup(step = 0) {
  const onStep = vi.fn();
  const onClose = vi.fn();
  render(
    <>
      <div data-tour="a">A</div>
      <div data-tour="b">B</div>
      <div data-tour="c">C</div>
      <GuidedTour steps={steps} step={step} onStep={onStep} onClose={onClose} />
    </>,
  );
  return { onStep, onClose };
}

describe("GuidedTour", () => {
  it("shows the step number, title and message", () => {
    setup(1);
    expect(screen.getByRole("dialog", { name: "Pick your tile" })).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Tap a tile.")).toBeInTheDocument();
  });

  it("Next and Back move between steps", async () => {
    const { onStep } = setup(1);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onStep).toHaveBeenLastCalledWith(2);
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onStep).toHaveBeenLastCalledWith(0);
  });

  it("has no Back on the first step", () => {
    setup(0);
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  it("'Got it' on the last step finishes; Skip and Escape close early", async () => {
    const user = userEvent.setup();
    const last = setup(2);
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(last.onClose).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(last.onClose).toHaveBeenLastCalledWith(false);
    await user.keyboard("{Escape}");
    expect(last.onClose).toHaveBeenLastCalledWith(false);
  });
});

describe("tour", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("walks from space selection through template → tile → room → Generate", () => {
    expect(TOUR_STEPS.map((s) => s.target)).toEqual(["space", "template", "tile", "room", "generate"]);
    expect(TOUR_STEPS[0].screen).toBe("spaces");
    expect(TOUR_STEPS[1].screen).toBe("gallery");
  });

  it("is shown once per account on this browser", () => {
    expect(hasSeenTour("user-1")).toBe(false);
    markTourSeen("user-1");
    expect(hasSeenTour("user-1")).toBe(true);
    expect(hasSeenTour("user-2")).toBe(false);
  });
});
