// Request validation with zod.
import { z } from "npm:zod@3.23.8";
import { DEFAULT_FLOOR_TILE_FINISH, FLOOR_TILE_FINISHES, floorGrid, type FloorLayout } from "./floor-layout.ts";
import { Errors } from "./http.ts";
import { SPACE_IDS } from "./render-spaces.ts";

export { z };

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw Errors.badRequest("Invalid request.", result.error.flatten().fieldErrors);
  }
  return result.data;
}

export const uuid = z.string().uuid();

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  before: z.string().optional(),
});

export const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120).nullable().optional(),
    company: z.string().trim().max(120).nullable().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number")
      .nullable()
      .optional(),
  })
  .strict();

export const spendLimitSchema = z
  .object({
    /** Whole rupees, e.g. 5000 = ₹5,000 */
    monthly_limit_inr: z.number().int().min(0).max(1_000_000),
  })
  .strict();

export const gstinSchema = z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/, "Enter a valid GSTIN");

const checkoutDetails = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).regex(/^\+?[0-9 ()-]{7,20}$/).refine((value) => {
    const digits = value.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }, "Enter a valid contact number"),
  company: z.string().trim().max(120).optional(),
  gstin: gstinSchema.optional(),
}).strict();

export const checkoutSchema = z.object({
  pack_id: z.string().min(1).max(40),
  expected_amount_paise: z.number().int().positive().optional(),
  details: checkoutDetails.optional(),
}).strict().refine((data) => !data.details || data.expected_amount_paise !== undefined, {
  path: ["expected_amount_paise"], message: "Confirm the displayed price.",
});

export const confirmPaymentSchema = z
  .object({
    provider_payment_id: z.string().max(120).optional(),
    provider_order_id: z.string().max(120).optional(),
    signature: z.string().max(256).optional(),
  })
  .strict();

export const generationSchema = z
  .object({
    type: z.string().min(1).max(40).default("standard"),
    room_type: z.string().trim().max(40).optional(),
    input: z.record(z.unknown()).default({}),
  })
  .strict();

const positiveDimension = z.number().finite().positive();
const floorLayoutFields = z.object({
  floorWidthFeet: positiveDimension,
  floorLengthFeet: positiveDimension,
  tileLongSideInches: positiveDimension,
  tileShortSideInches: positiveDimension,
  direction: z.enum(["horizontal", "vertical"]),
}).strict();
const validFloorLayout = (layout: FloorLayout) =>
  layout.tileLongSideInches >= layout.tileShortSideInches && floorGrid(layout) !== null;
const floorLayoutError = { message: "Enter valid floor and tile dimensions." };
export const floorLayoutSchema = floorLayoutFields.refine(validFloorLayout, floorLayoutError);
export const floorPreviewSchema = floorLayoutFields.extend({
  tileFinish: z.enum(FLOOR_TILE_FINISHES).default(DEFAULT_FLOOR_TILE_FINISH),
}).refine(validFloorLayout, floorLayoutError);

const floorLayoutField = z.string().max(300).transform((value, context): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid floor layout." });
    return z.NEVER;
  }
}).pipe(floorLayoutSchema);

/** Text fields of the multipart POST /v1/generations request (photos are separate "image" parts). */
export const generationFormSchema = z
  .object({
    type: z.enum(["standard", "hd", "ultra"]).default("standard"),
    template_id: z.string().min(1).max(40),
    space: z.enum(SPACE_IDS).optional(),
    tile_in_room: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
    floor_layout: floorLayoutField.optional(),
  })
  .strict();

export const completeGenerationSchema = z.object({ output_url: z.string().url() }).strict();
export const failGenerationSchema = z.object({ error: z.string().max(500).optional() }).strict();
