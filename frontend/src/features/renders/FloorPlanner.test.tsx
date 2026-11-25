import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import FloorPlannerPage from "@/app/dashboard/floor-planner/page";
import { resetRenderJob } from "./hooks";

const api = vi.hoisted(() => ({ floorPreview: vi.fn(), render: vi.fn() }));
vi.mock("@/lib/api", () => ({ api }));
vi.mock("@/lib/swr", () => ({ useRevalidate: () => () => Promise.resolve() }));
vi.mock("@/features/account/hooks", () => ({
  useAccount: () => ({ account: { wallet: { balance: 5 } } }),
}));

afterEach(() => resetRenderJob());

it("generates a default plan without inputs and updates the exact diagram for measured layouts", async () => {
  api.floorPreview.mockResolvedValue({
    image: "data:image/png;base64,iVBORw0KGgo=",
    generation: { id: "floor-preview-result" },
  });
  render(<ToastProvider><FloorPlannerPage /></ToastProvider>);

  expect(screen.getByRole("heading", { name: "Floor planner" })).toBeInTheDocument();
  expect(screen.getByText("60 tiles")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "horizontal tile layout, 6 columns by 10 rows" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Generate preview/ }));
  expect(api.floorPreview).toHaveBeenCalledWith({
    floorWidthFeet: 12, floorLengthFeet: 10, tileLongSideInches: 24, tileShortSideInches: 12, direction: "horizontal", tileFinish: "warm-grey-concrete",
  }, expect.any(String));
  expect(api.render).not.toHaveBeenCalled();
  await screen.findByAltText("Your tile render");

  const finish = screen.getByRole("radio", { name: "Green marble" });
  fireEvent.click(finish);
  expect(finish).toBeChecked();
  expect(screen.getByRole("img", { name: "horizontal tile layout, 6 columns by 10 rows" })).toHaveStyle({
    backgroundImage: 'url("/samples/floor/tiles/09.jpg")',
  });
  expect(screen.getByText(/previous layout or tile finish/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Generate preview/ }));
  expect(api.floorPreview).toHaveBeenLastCalledWith(expect.objectContaining({ tileFinish: "green-marble" }), expect.any(String));
  await screen.findByAltText("Your tile render");

  fireEvent.click(screen.getByText("Adjust measurements"));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Floor width" }), { target: { value: "10" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Floor length" }), { target: { value: "9" } });
  expect(screen.getByText("45 tiles")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "vertical" }));
  expect(screen.getByText("50 tiles")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "vertical tile layout, 10 columns by 5 rows" })).toBeInTheDocument();
  expect(screen.getByText(/40 full tiles and 10 positions with cuts/)).toBeInTheDocument();
  expect(screen.getByText(/previous layout/)).toBeInTheDocument();
});
