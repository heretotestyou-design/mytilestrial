import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FallbackImage } from "./FallbackImage";

describe("FallbackImage", () => {
  it("shows a loader until the image arrives", () => {
    render(<FallbackImage src="/a.jpg" alt="Tile" />);
    expect(screen.getByLabelText("Loading image")).toBeInTheDocument();
    fireEvent.load(screen.getByAltText("Tile"));
    expect(screen.queryByLabelText("Loading image")).not.toBeInTheDocument();
  });

  it("shows the placeholder caption when the file is missing", () => {
    render(<FallbackImage src="/missing.jpg" alt="Tile" caption="tiles/01.jpg" />);
    fireEvent.error(screen.getByAltText("Tile"));
    expect(screen.queryByLabelText("Loading image")).not.toBeInTheDocument();
    expect(screen.getByText("tiles/01.jpg")).toBeInTheDocument();
  });

  it("doesn't stay stuck loading when the image was already cached", () => {
    const complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const width = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => 800 });
    try {
      render(<FallbackImage src="/cached.jpg" alt="Tile" />);
      expect(screen.queryByLabelText("Loading image")).not.toBeInTheDocument();
      expect(screen.getByAltText("Tile")).toHaveClass("opacity-100");
    } finally {
      if (complete) Object.defineProperty(HTMLImageElement.prototype, "complete", complete);
      if (width) Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", width);
    }
  });
});
