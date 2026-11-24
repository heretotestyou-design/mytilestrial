import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";

const api = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("@/lib/api", () => ({ api }));
vi.mock("@/lib/swr", () => ({ useRevalidate: () => () => Promise.resolve() }));

import { resetRenderJob, useRememberedState, useRenderJob } from "./hooks";

const wrapper = ({ children }: { children: React.ReactNode }) => <ToastProvider>{children}</ToastProvider>;
const args = { photos: [new File(["x"], "t.jpg", { type: "image/jpeg" })], templateId: "floor-full", templateName: "Full floor" };

afterEach(() => resetRenderJob());

describe("render job", () => {
  it("keeps 'rendering' after leaving the page and blocks a second paid render", async () => {
    let finish!: (v: unknown) => void;
    api.render.mockReturnValue(new Promise((r) => (finish = r)));
    const first = renderHook(() => useRenderJob(), { wrapper });
    act(() => void first.result.current.start(args));
    first.unmount(); // user navigates to "My renders"

    const back = renderHook(() => useRenderJob(), { wrapper });
    expect(back.result.current.busy).toBe(true);
    await act(() => back.result.current.start(args));
    expect(api.render).toHaveBeenCalledTimes(1);

    await act(async () => finish({ image: "data:image/png;base64,iVBORw0KGgo=", generation: { id: "g1" } }));
    await waitFor(() => expect(back.result.current.busy).toBe(false));
    expect(back.result.current.result?.id).toBe("g1");
  });

  it("remembers studio choices across unmounts", () => {
    const a = renderHook(() => useRememberedState("test.choice", "none"));
    act(() => a.result.current[1]("marble"));
    a.unmount();
    const b = renderHook(() => useRememberedState("test.choice", "none"));
    expect(b.result.current[0]).toBe("marble");
  });
});
