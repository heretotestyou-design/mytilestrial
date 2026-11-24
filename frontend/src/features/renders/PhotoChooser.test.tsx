import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sampleImages } from "@/lib/samples";
import { PhotoChooser } from "./PhotoChooser";

const samples = sampleImages("Floor", "tile");

function setup(props: Partial<React.ComponentProps<typeof PhotoChooser>> = {}) {
  const onChange = vi.fn();
  const onError = vi.fn();
  render(
    <PhotoChooser title="Tile" hint="hint" shape="square" samples={samples} file={null} onChange={onChange} onError={onError} {...props} />,
  );
  return { onChange, onError };
}

describe("PhotoChooser", () => {
  it("shows every example plus one add-your-photo card", () => {
    setup();
    expect(screen.getAllByRole("button", { name: /^Use Tile/ })).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Add your own tile" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /take a photo/i })).not.toBeInTheDocument();
  });

  it("the add card asks: camera or upload", async () => {
    setup();
    const user = userEvent.setup();
    const add = screen.getByRole("button", { name: "Add your own tile" });
    expect(add).toHaveAttribute("aria-expanded", "false");
    await user.click(add);
    expect(add).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem").map((b) => b.textContent?.trim());
    expect(items).toEqual(["Camera", "Upload"]);

    // Upload opens the file picker and closes the menu.
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await user.click(screen.getByRole("menuitem", { name: /upload/i }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    click.mockRestore();
  });

  it("Escape closes the camera/upload menu", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add your own tile" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("loads the picked example as a file", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Blob(["x"], { type: "image/jpeg" })));
    const { onChange } = setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "Use Tile 3" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/samples/floor/tiles/03.jpg");
    const [file, example] = onChange.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(example).toBe("/samples/floor/tiles/03.jpg");
  });

  it("marks the example in use", () => {
    setup({ file: new File(["x"], "02.jpg"), selected: samples[1].src });
    expect(screen.getByRole("button", { name: "Use Tile 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Use Tile 1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clears an optional slot when the chosen example is clicked again", async () => {
    const { onChange } = setup({ optional: true, file: new File(["x"], "02.jpg"), selected: samples[1].src });
    await userEvent.setup().click(screen.getByRole("button", { name: "Use Tile 2" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("accepts an uploaded image and rejects other files", async () => {
    const { onChange, onError } = setup();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(input, new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(onError).toHaveBeenCalledWith("Use a JPG, PNG or WebP image.");
    const tile = new File(["x"], "tile.png", { type: "image/png" });
    await user.upload(input, tile);
    expect(onChange).toHaveBeenCalledWith(tile);
  });
});
