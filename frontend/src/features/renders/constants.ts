import type { IconName } from "@/components/ui/Icon";
import type { TEMPLATE_CATEGORIES } from "@/lib/catalog";

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const CATEGORY_ICON: Record<TemplateCategory, IconName> = {
  Floor: "grid",
  Walls: "layers",
  "Floor and walls": "home",
  Theme: "wand",
};

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
