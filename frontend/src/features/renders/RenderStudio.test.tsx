import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { findRenderSpace } from "@/lib/render-spaces";

vi.mock("@/features/account/hooks", () => ({
  useAccount: () => ({ account: { profile: { id: "u1", email: "a@b.co" }, wallet: { balance: 50 } } }),
}));
vi.mock("@/lib/api", () => ({ api: { render: vi.fn() } }));
vi.mock("@/lib/swr", () => ({ useRevalidate: () => () => Promise.resolve() }));
const prepareWallEdit = vi.hoisted(() => vi.fn());
vi.mock("./wallEdit", () => ({ prepareWallEdit }));

const { RenderStudio } = await import("./RenderStudio");
const { resetRenderJob } = await import("./hooks");

const scrolled: Element[] = [];
beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this);
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(new Blob(["x"], { type: "image/jpeg" })));
});
afterEach(() => {
  resetRenderJob();
  vi.restoreAllMocks();
});

function setup(templateId = "floor-full") {
  render(
    <ToastProvider>
      <RenderStudio templateId={templateId} onTemplateChange={vi.fn()} onBack={vi.fn()} />
    </ToastProvider>,
  );
  return userEvent.setup();
}

describe("Your selection", () => {
  // First: chosen photos are remembered for the session (across tests too).
  it("with nothing chosen, it takes you to that section to pick one", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Choose a tile" }));
    expect(scrolled[0]).toHaveAttribute("data-slot", "photo1");
  });

  it("tapping the chosen tile shows that tile in the Tile section and flashes it", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Use Tile 4" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Use Tile 4" })).toHaveAttribute("aria-pressed", "true"));

    await user.click(screen.getByRole("button", { name: "Show the chosen tile" }));
    const tile4 = screen.getByRole("button", { name: "Use Tile 4" });
    expect(scrolled).toContain(tile4);
    expect(tile4).toHaveClass("flash-pick");
  });

  it("tapping the chosen room shows that room in the Room section", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Use Room 2" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Use Room 2" })).toHaveAttribute("aria-pressed", "true"));

    await user.click(screen.getByRole("button", { name: "Show the chosen room" }));
    expect(scrolled).toContain(screen.getByRole("button", { name: "Use Room 2" }));
  });

});

it("keeps Full floor as a photo-based template", () => {
  setup("floor-full");
  expect(screen.getByRole("heading", { name: "Full floor" })).toBeInTheDocument();
  expect(screen.queryByText("Adjust measurements")).not.toBeInTheDocument();
});

describe("Select a wall", () => {
  it("requires a wall, lets the user adjust a corner, and clears the selection on a new room photo", async () => {
    const user = setup("wall-select");
    await user.click(screen.getByRole("button", { name: "Use Tile 4" }));
    await user.click(screen.getByRole("button", { name: "Use Room 1" }));
    await screen.findByRole("heading", { name: "Select the wall to tile" });
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Left wall" }));
    const handle = screen.getByRole("button", { name: "Top left wall corner" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveStyle({ left: "5%" });
    expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Use Room 2" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Top left wall corner" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Back wall" }));
    const mask = new File(["mask"], "wall-mask.png", { type: "image/png" });
    const room = new File(["prepared room"], "room.png", { type: "image/png" });
    const compose = vi.fn().mockResolvedValue(new Blob(["composited result"], { type: "image/png" }));
    prepareWallEdit.mockResolvedValueOnce({ mask, room, compose });
    const output = "data:image/png;base64,AAAA";
    vi.mocked(api.render).mockResolvedValueOnce({
      generation: { id: "wall-render" } as Awaited<ReturnType<typeof api.render>>["generation"],
      image: output,
      balance: 49,
    });
    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(prepareWallEdit).toHaveBeenCalledWith(expect.any(File), expect.arrayContaining([{ x: 0.29, y: 0.23 }]));
    expect(api.render).toHaveBeenCalledWith(expect.objectContaining({
      templateId: "wall-select",
      photos: [expect.any(File), room],
      wallMask: mask,
    }), expect.any(String));
    expect(compose).toHaveBeenCalledWith(output);
    expect(await screen.findByRole("img", { name: "Your tile render" })).toHaveClass("object-contain");
  });
});

it("replaces the Dining room studio examples when changing spaces", async () => {
  const studio = (id: string) => (
    <ToastProvider>
      <RenderStudio templateId="floor-border" space={findRenderSpace(id)} onTemplateChange={vi.fn()} onBack={vi.fn()} />
    </ToastProvider>
  );
  const { rerender } = render(studio("dining-room"));
  const user = userEvent.setup();

  expect(screen.queryByRole("button", { name: "Use Room 1" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Use Tile 1" })).not.toBeInTheDocument();
  const tile = screen.getByRole("button", { name: "Use Gold-veined marble" });
  const room = screen.getByRole("button", { name: "Use Dining room 4" });
  await user.click(tile);
  await user.click(room);
  await waitFor(() => expect(room).toHaveAttribute("aria-pressed", "true"));
  expect(tile).toHaveAttribute("aria-pressed", "true");

  rerender(studio("kitchen"));
  expect(screen.queryByRole("button", { name: "Use Dining room 4" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use Kitchen 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use Ivory terrazzo" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use Gold-veined marble" })).toHaveAttribute("aria-pressed", "false");
});
