import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminMonitor } from "./AdminMonitor";

const { snapshot } = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock("swr", () => ({ default: snapshot }));
vi.mock("@jamesalmeida/agent-avatars", () => ({
  AgentAvatar: ({ mood }: { mood: string }) => <span data-testid="agent" data-mood={mood} />,
}));

it("changes the avatar when the latest check reports issues", () => {
  snapshot.mockReturnValue({
    data: { runs: [{
      id: 10, status: "issues", checkedAt: new Date().toISOString(),
      url: "https://github.com/heretotestyou-design/mytilestrial/actions/runs/10",
    }] },
  });
  render(<AdminMonitor />);
  expect(screen.getByRole("status")).toHaveTextContent("Issues detected");
  expect(screen.getByTestId("agent")).toHaveAttribute("data-mood", "sorry");
  expect(screen.getByRole("link", { name: "View run 10" })).toBeInTheDocument();
});
