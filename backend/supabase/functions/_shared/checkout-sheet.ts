import { importPKCS8, SignJWT } from "npm:jose@5.9.6";
import { admin } from "./supabase.ts";
import { ApiError, fromDbError } from "./http.ts";

type CheckoutContact = {
  id: number;
  created_at: string;
  payment_id: string | null;
  guest_order_id: string | null;
  full_name: string;
  phone: string;
  email: string;
  company: string | null;
  gstin: string | null;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const COLUMNS = "id, created_at, payment_id, guest_order_id, full_name, phone, email, company, gstin";
let cachedToken: { value: string; expires: number } | undefined;

export function sheetConfigured() {
  return Boolean(Deno.env.get("GOOGLE_SHEETS_ID") && Deno.env.get("GOOGLE_SHEETS_SERVICE_ACCOUNT"));
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const { client_email, private_key } = JSON.parse(Deno.env.get("GOOGLE_SHEETS_SERVICE_ACCOUNT") ?? "{}");
  if (typeof client_email !== "string" || typeof private_key !== "string") throw new Error("Invalid Sheets credentials");
  const key = await importPKCS8(private_key, "RS256");
  const assertion = await new SignJWT({ scope: SCOPE }).setProtectedHeader({ alg: "RS256" })
    .setIssuer(client_email).setAudience(TOKEN_URL).setIssuedAt().setExpirationTime("5m").sign(key);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Google access token request failed (${response.status})`);
  const token = await response.json();
  if (typeof token.access_token !== "string") throw new Error("Google returned no access token");
  cachedToken = { value: token.access_token, expires: Date.now() + Math.max(0, Number(token.expires_in) - 60) * 1000 };
  return cachedToken.value;
}

async function writeRows(rows: CheckoutContact[]) {
  const id = encodeURIComponent(Deno.env.get("GOOGLE_SHEETS_ID") ?? "");
  const tab = Deno.env.get("GOOGLE_SHEETS_TAB") || "Checkout";
  const range = (row: number) => `'${tab.replaceAll("'", "''")}'!A${row}:H${row}`;
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;
  const headers = { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" };
  const send = (path: string, body?: unknown) => fetch(base + path, {
    method: body ? "POST" : "GET", headers,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000),
  });
  const data = [
    { range: range(1), values: [["Checkout ID", "Submitted at (UTC)", "Payment ID", "Full name", "Contact", "Email", "Company", "GSTIN"]] },
    ...rows.map((row) => ({
      range: range(row.id),
      values: [[row.id, row.created_at, row.payment_id ?? row.guest_order_id, row.full_name, row.phone, row.email, row.company ?? "", row.gstin ?? ""]],
    })),
  ];
  const write = () => send("/values:batchUpdate", { valueInputOption: "RAW", data });
  let result = await write();
  if (result.status === 400) {
    const metadata = await send("?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))");
    if (!metadata.ok) throw new Error(`Google sheet metadata request failed (${metadata.status})`);
    const { sheets } = await metadata.json();
    const grid = sheets?.find((sheet: { properties: { title: string } }) => sheet.properties.title === tab)?.properties;
    if (!grid?.gridProperties) throw new Error("Checkout sheet tab does not exist");
    const { rowCount, columnCount } = grid.gridProperties;
    const requests = [];
    const needed = Math.max(...rows.map((row) => row.id));
    if (needed > rowCount) requests.push({ appendDimension: { sheetId: grid.sheetId, dimension: "ROWS", length: Math.max(250, needed - rowCount) } });
    if (columnCount < 8) requests.push({ appendDimension: { sheetId: grid.sheetId, dimension: "COLUMNS", length: 8 - columnCount } });
    if (requests.length) {
      const expanded = await send(":batchUpdate", { requests });
      if (!expanded.ok) throw new Error(`Google sheet expansion failed (${expanded.status})`);
      result = await write();
    }
  }
  if (!result.ok) {
    if (result.status === 401) cachedToken = undefined;
    throw new Error(`Google sheet write failed (${result.status})`);
  }
}

export async function syncCheckoutContacts(paymentId?: string, guestOrderId?: string): Promise<number> {
  if (!sheetConfigured()) throw new ApiError(409, "SHEET_NOT_CONFIGURED", "Google Sheets is not connected.");
  let query = admin.from("checkout_contacts").select(COLUMNS).is("sheet_synced_at", null).order("id").limit(50);
  if (paymentId) query = query.eq("payment_id", paymentId);
  if (guestOrderId) query = query.eq("guest_order_id", guestOrderId);
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  const rows = data as CheckoutContact[];
  if (!rows.length) return 0;
  try {
    // Each checkout has a permanent row number. Replaying a sync replaces that row.
    await writeRows(rows);
  } catch (error) {
    console.error("Checkout Sheet sync:", error instanceof Error ? error.message : "Unexpected error");
    throw new ApiError(502, "SHEET_SYNC_FAILED", "Google Sheets sync failed. The checkout details are saved and can be retried.");
  }
  const result = await admin.from("checkout_contacts").update({ sheet_synced_at: new Date().toISOString() })
    .in("id", rows.map((row) => row.id));
  if (result.error) throw fromDbError(result.error);
  return rows.length;
}

export async function syncNewCheckout(paymentId?: string, guestOrderId?: string) {
  if (!sheetConfigured()) return;
  const sync = syncCheckoutContacts(paymentId, guestOrderId).catch(() => {});
  const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(sync);
  else await sync;
}
