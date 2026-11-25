import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OverviewView } from "./OverviewView";

const { replace, search } = vi.hoisted(() => ({ replace: vi.fn(), search: { value: "" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/features/account/hooks", () => ({ useAccount: () => ({}) }));
vi.mock("@/features/renders/RenderStudio", () => ({
  RenderStudio: ({ space, onBack }: { space?: { name: string }; onBack: () => void }) => (
    <button type="button" onClick={onBack}>Back from {space?.name ?? "studio"}</button>
  ),
}));

it("shows spaces first and keeps the chosen space through categories, studio and back", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<OverviewView />);

  expect(screen.getByRole("heading", { name: "Choose a space" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /^Walls/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Kitchen" }));
  expect(screen.getByRole("heading", { name: "Kitchen layouts" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Full floor/ }).querySelector("img")).toHaveAttribute(
    "src", "/samples/space-templates/kitchen/floor-full.webp",
  );
  expect(replace).toHaveBeenLastCalledWith("/dashboard?space=kitchen", { scroll: false });

  const walls = screen.getByRole("tab", { name: /^Walls/ });
  fireEvent.click(walls);
  expect(walls).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("button", { name: /All walls/ }));
  expect(screen.getByRole("button", { name: "Back from Kitchen" })).toBeInTheDocument();
  expect(replace).toHaveBeenLastCalledWith("/dashboard?space=kitchen&template=walls-all", { scroll: false });

  fireEvent.click(screen.getByRole("button", { name: "Back from Kitchen" }));
  expect(walls).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("button", { name: "All spaces" }));
  fireEvent.click(screen.getByRole("button", { name: "Bedroom" }));
  expect(screen.getByRole("heading", { name: "Bedroom layouts" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Full floor/ }).querySelector("img")).toHaveAttribute(
    "src", "/samples/space-templates/bedroom/floor-full.webp",
  );
  expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
});
