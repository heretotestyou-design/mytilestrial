import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sampleImages } from "@/lib/samples";
import { cameraError } from "./CameraCapture";
import { PhotoChooser } from "./PhotoChooser";

const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
afterEach(() => {
  if (original) Object.defineProperty(navigator, "mediaDevices", original);
  else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
});

describe("camera", () => {
  it("explains camera failures in plain words", () => {
    expect(cameraError(new DOMException("", "NotAllowedError"))).toMatch(/blocked/i);
    expect(cameraError(new DOMException("", "NotFoundError"))).toMatch(/no camera/i);
    expect(cameraError(new DOMException("", "NotReadableError"))).toMatch(/another app/i);
  });

  it("offers Take a photo from the add-your-photo card", async () => {
    render(<PhotoChooser title="Tile" hint="" shape="square" samples={sampleImages("Floor", "tile")} file={null} onChange={vi.fn()} onError={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Add your own tile" }));
    expect(screen.getByRole("menuitem", { name: /camera/i })).toBeInTheDocument();
  });

  it("opens the in-app camera on a computer and reports a blocked camera", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException("", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } });
    render(<PhotoChooser title="Room" hint="" shape="wide" samples={[]} file={null} onChange={vi.fn()} onError={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add your own room" }));
    await user.click(screen.getByRole("menuitem", { name: /camera/i }));
    expect(await screen.findByRole("dialog", { name: /take a photo · room/i })).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }));
    expect(await screen.findByText(/camera access was blocked/i)).toBeInTheDocument();
  });
});
