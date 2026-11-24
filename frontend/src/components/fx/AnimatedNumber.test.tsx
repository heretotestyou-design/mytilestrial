import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedNumber, resetAnimatedNumbers } from "./AnimatedNumber";

afterEach(() => resetAnimatedNumbers());

describe("AnimatedNumber", () => {
  it("doesn't re-count from 0 when it is mounted again (e.g. sidebar collapse)", () => {
    const first = render(<AnimatedNumber id="wallet.balance" value={147} />);
    first.unmount();
    render(<AnimatedNumber id="wallet.balance" value={147} />);
    // Shown value is already 147 on the very first paint, not 0.
    expect(screen.getByLabelText("147").textContent).toBe("147");
  });

  it("still starts from 0 the first time a value appears", () => {
    render(<AnimatedNumber id="fresh" value={50} />);
    expect(screen.getByLabelText("50").textContent).toBe("0");
  });
});
