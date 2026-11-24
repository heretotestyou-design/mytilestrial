import { describe, expect, it } from "vitest";
import { LOW_CREDIT_THRESHOLD } from "@/lib/catalog";
import { isLowBalance, shouldPrompt, snoozeLowCredit } from "./lowCredit";

describe("low-credit prompt rules", () => {
  const now = 1_800_000_000_000;

  it("is low at or below the threshold", () => {
    expect(isLowBalance(LOW_CREDIT_THRESHOLD)).toBe(true);
    expect(isLowBalance(LOW_CREDIT_THRESHOLD + 1)).toBe(false);
    expect(isLowBalance(0)).toBe(true);
  });

  it("does not prompt a new account with the signup bonus", () => {
    expect(shouldPrompt(5, now)).toBe(false);
  });

  it("prompts when low and not snoozed", () => {
    expect(shouldPrompt(2, now)).toBe(true);
  });

  it("stays quiet for 12 hours after 'Remind me later'", () => {
    snoozeLowCredit(2, now);
    expect(shouldPrompt(2, now + 60_000)).toBe(false);
    expect(shouldPrompt(2, now + 12 * 3600_000 + 1)).toBe(true);
  });

  it("prompts again during a snooze if the balance drops further", () => {
    snoozeLowCredit(3, now);
    expect(shouldPrompt(0, now + 60_000)).toBe(true);
  });
});
