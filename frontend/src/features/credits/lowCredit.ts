// When to nag about a low balance. "Remind me later" quiets the prompt for 12 hours,
// unless the balance drops further in the meantime (e.g. from 3 down to 0).
import { LOW_CREDIT_THRESHOLD } from "@/lib/catalog";

const KEY = "mtt.lowCredit";
const SNOOZE_MS = 12 * 60 * 60 * 1000;

export const isLowBalance = (balance: number) => balance <= LOW_CREDIT_THRESHOLD;

type Snooze = { balance: number; until: number };

function read(): Snooze | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Snooze) : null;
  } catch {
    return null;
  }
}

export function shouldPrompt(balance: number, now = Date.now()) {
  if (!isLowBalance(balance)) return false;
  const s = read();
  return !s || s.until <= now || balance < s.balance;
}

export function snoozeLowCredit(balance: number, now = Date.now()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ balance, until: now + SNOOZE_MS } satisfies Snooze));
  } catch {
    /* storage unavailable: the prompt may reappear, which is acceptable */
  }
}
