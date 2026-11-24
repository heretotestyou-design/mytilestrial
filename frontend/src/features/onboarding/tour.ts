// The first-login walkthrough of the home screen: template → tile → room → Generate.
import type { TourStep } from "./GuidedTour";

export type Screen = "spaces" | "gallery" | "studio";

export const TOUR_STEPS: (TourStep & { screen: Screen })[] = [
  {
    screen: "spaces",
    target: "space",
    title: "Choose a space",
    body: "Start with the kind of room you want to visualize, such as a living room, kitchen or bedroom.",
  },
  {
    screen: "gallery",
    target: "template",
    title: "Choose a template",
    body: "Each template is a different way to lay your tile: full floor, corners, a feature wall and more. Tap one to open it.",
  },
  {
    screen: "studio",
    target: "tile",
    title: "Pick your tile",
    body: "Tap one of the example tiles, or tap “Add your tile” to take a photo with your camera or upload one.",
  },
  {
    screen: "studio",
    target: "room",
    title: "Pick a room (optional)",
    body: "Use an example room or a photo of your own room. Skip the photo to generate a scene for your chosen space.",
  },
  {
    screen: "studio",
    target: "generate",
    title: "Press Generate",
    body: "Your chosen photos show here. Each render uses 1 image from your balance, and your result appears here in about a minute.",
  },
];

// Per browser + account: a convenience, so a failed read just shows the tour again.
const key = (userId: string) => `mtt.tour.done.${userId}`;

export function hasSeenTour(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
}

export function markTourSeen(userId: string) {
  try {
    localStorage.setItem(key(userId), "1");
  } catch {
    /* storage blocked: fine */
  }
}
