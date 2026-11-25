import type { FloorTileFinish } from "./samples";

// Types mirroring the API responses (backend/supabase/functions/api).

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  created_at: string;
};

export type Wallet = {
  balance: number;
  lifetime_purchased: number;
  lifetime_used: number;
  monthly_spend_limit_paise: number;
  month_spend_paise: number;
  month_remaining_paise: number;
  currency: "INR";
  /** The one-time ₹0 plan has been used. */
  free_plan_claimed: boolean;
  updated_at: string;
};

export type Account = { profile: Profile; wallet: Wallet };

export type CheckoutContact = {
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  gstin?: string | null;
};

export type CheckoutDetails = { full_name: string; phone: string; company?: string; gstin?: string };

export type AdminUser = Profile & { balance: number };

export type AdminPeriod = 7 | 30 | 90;

export type AdminAnalytics = {
  series: { starts_on: string; ends_on: string; registrations: number; revenue_paise: number }[];
  orders: Record<Payment["status"], number>;
};

export type AdminSummary = {
  users: number;
  paid_orders: number;
  paid_amount_paise: number;
  pending_sheet_rows: number;
  sheet_connected: boolean;
};

export type AdminOverview = AdminSummary & {
  contacts: (CheckoutContact & {
    id: number;
    created_at: string;
    sheet_synced_at: string | null;
    payment: Pick<Payment, "pack_id" | "status" | "amount_paise"> | null;
  })[];
};

export type CreditPack = {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  bonus_credits: number;
  price_paise: number;
  is_featured: boolean;
  is_test?: boolean;
  validity_months?: number | null;
};

export type GenerationCost = {
  type: string;
  label: string;
  description: string | null;
  credits: number;
};

export type FreePlan = { credits: number; price_paise: 0 };

export type Catalog = { currency: "INR"; packs: CreditPack[]; generation_costs: GenerationCost[]; free_plan: FreePlan | null; payments?: { provider: string; test_mode: boolean } };

export type CreditTransaction = {
  id: number;
  delta: number;
  balance_after: number;
  kind: "signup_bonus" | "purchase" | "generation" | "refund" | "adjustment";
  description: string | null;
  payment_id: string | null;
  generation_id: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  pack_id: string;
  amount_paise: number;
  base_amount_paise?: number | null;
  credits: number;
  currency: string;
  provider: string;
  provider_order_id: string | null;
  status: "created" | "paid" | "failed" | "cancelled";
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  validity_months?: number | null;
  credits_expire_at?: string | null;
};

export type Generation = {
  id: string;
  type: string;
  status: "queued" | "processing" | "completed" | "failed";
  credits_charged: number;
  refunded: boolean;
  room_type: string | null;
  input: Record<string, unknown>;
  output_url: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export type DeviceSession = {
  id: string;
  created_at: string;
  last_active_at: string;
  user_agent: string | null;
  ip: string | null;
  /** The device making this request. */
  current: boolean;
};

export type Page<T> = { items: T[]; next_cursor: string | null };

export type Checkout = {
  payment: Payment;
  checkout: {
    provider: string;
    order_id: string;
    /** Razorpay only: public key id, amount in paise, currency, merchant name. */
    key_id?: string;
    amount?: number;
    currency?: string;
    name?: string;
    [key: string]: unknown;
  };
};
export type FloorLayout = {
  floorWidthFeet: number;
  floorLengthFeet: number;
  tileLongSideInches: number;
  tileShortSideInches: number;
  direction: "horizontal" | "vertical";
};

export type FloorPreviewLayout = FloorLayout & { tileFinish?: FloorTileFinish };
