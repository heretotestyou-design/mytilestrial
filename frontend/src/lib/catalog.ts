// Static copy of the catalog for the marketing pages (keeps the landing page
// fast and SEO-friendly). Must match backend/supabase/migrations/*_catalog.sql.
// The dashboard always reads live prices from GET /v1/catalog.
import type { CreditPack, GenerationCost } from "@/lib/types";

export const SIGNUP_BONUS_CREDITS = 5;

export const PACKS = [
  { id: "starter", name: "Starter", description: "For homeowners and small projects.", credits: 100, bonus_credits: 0, price_paise: 149900, list_price_paise: 179900, validity_months: 1, is_featured: false },
  { id: "studio", name: "Studio", description: "For designers and growing showrooms.", credits: 400, bonus_credits: 0, price_paise: 499900, list_price_paise: 624900, validity_months: 3, is_featured: true },
  { id: "showroom", name: "Showroom", description: "For high-volume showrooms and dealers.", credits: 1000, bonus_credits: 0, price_paise: 999900, list_price_paise: 1249900, validity_months: 6, is_featured: false },
] satisfies (CreditPack & { list_price_paise: number })[];

export const PREMIUM_OFFER = {
  name: "Premium",
  price_paise: 2499900,
  list_price_paise: 3124900,
  validity_months: 12,
  contact: "mailto:connect@trinogenz.com?subject=MyTilesTrial%20Premium%20next%20slot",
};

export function validityLabel(months: number): string {
  return months === 12 ? "Valid for 1 year" : `Valid for ${months} ${months === 1 ? "month" : "months"}`;
}

export function percentOff(price: number, listPrice: number): number {
  return Math.round((1 - price / listPrice) * 100);
}

export const GENERATION_COSTS: GenerationCost[] = [
  { type: "standard", label: "Standard render", description: "Quick photoreal preview", credits: 1 },
  { type: "hd", label: "HD render", description: "High-detail render", credits: 2 },
  { type: "ultra", label: "Ultra render", description: "Highest detail, closest match to your tile", credits: 4 },
];

export const ROOM_TYPES = [
  "Living room",
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Dining",
  "Office",
  "Retail floor",
  "Outdoor patio",
  "Pool deck",
  "Staircase",
] as const;

// Render templates (ids must match backend/supabase/functions/_shared/templates.ts,
// where the prompts live). Copied from trino-ai's IMAGE_TEMPLATES.
export const THEME_TEMPLATE_ID = "theme-transfer";
export const WALL_SELECTION_TEMPLATE_ID = "wall-select";

export const TEMPLATE_CATEGORIES = ["Floor", "Walls", "Floor and walls", "Theme"] as const;

export const RENDER_TEMPLATES: { id: string; category: (typeof TEMPLATE_CATEGORIES)[number]; name: string; description: string }[] = [
  { id: "theme-transfer", category: "Theme", name: "Theme transfer", description: "Finish your site in the style of a reference photo" },
  { id: "floor-full", category: "Floor", name: "Full floor", description: "Whole floor in your tile, plain and even" },
  { id: "floor-corners", category: "Floor", name: "Corners", description: "A group of four tiles in each corner" },
  { id: "floor-center", category: "Floor", name: "Center panel", description: "Tile feature in the middle of the floor" },
  { id: "floor-border", category: "Floor", name: "Border frame", description: "Tile border around a plain center" },
  { id: "floor-checker", category: "Floor", name: "Checkerboard", description: "Alternating tile and plain squares" },
  { id: WALL_SELECTION_TEMPLATE_ID, category: "Walls", name: "Select a wall", description: "Choose one wall in your room photo" },
  { id: "walls-all", category: "Walls", name: "All walls", description: "Every visible wall covered" },
  { id: "wall-back", category: "Walls", name: "Back wall", description: "Only the wall facing the camera" },
  { id: "wall-left", category: "Walls", name: "Left wall", description: "Only the wall on the left" },
  { id: "wall-right", category: "Walls", name: "Right wall", description: "Only the wall on the right" },
  { id: "wall-feature", category: "Walls", name: "Feature strip", description: "Vertical tile strip on the main wall" },
  { id: "wall-half", category: "Walls", name: "Half height", description: "Lower half of the walls tiled" },
  { id: "mixed", category: "Floor and walls", name: "Mixed", description: "Center of the floor plus a main wall" },
];

/** At or below this balance the dashboard warns that credits are running low
 *  (less than one Ultra render; a new account's 5 credits don't trigger it on the first render). */
export const LOW_CREDIT_THRESHOLD = 3;

/** Temporary ₹0 plan (mirrors FREE_PLAN_CREDITS on the API; the dashboard reads the live value). */
export const FREE_PLAN = { credits: 50, price_paise: 0 } as const;
