import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/Toast";

const download = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("./sessionRenders", () => ({ downloadRender: download.fn }));

import { DownloadNotice } from "./DownloadNotice";

const r = { id: "r1", src: "blob:x", title: "Full floor", createdAt: 0, downloaded: false };
const show = () => render(<ToastProvider><DownloadNotice render={r} /></ToastProvider>);

describe("DownloadNotice", () => {
  it("confirms when the image is saved", async () => {
    download.fn.mockResolvedValue(undefined);
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: /download/i }));
    expect(await screen.findByText(/saved to your device/i)).toBeInTheDocument();
  });

  it("explains what to do when the download fails", async () => {
    download.fn.mockRejectedValue(new Error("boom"));
    show();
    await userEvent.setup().click(screen.getByRole("button", { name: /download/i }));
    expect(await screen.findByText(/couldn't download this image/i)).toBeInTheDocument();
  });
});
