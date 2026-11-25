export type MonitorRun = {
  id: number;
  checkedAt: string;
  status: "running" | "passed" | "cancelled" | "issues";
  url: string;
};

export type MonitorStatus = { runs: MonitorRun[] };
