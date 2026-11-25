import type { Metadata } from "next";
import { FloorPlanner } from "@/features/renders/FloorPlanner";

export const metadata: Metadata = { title: "Floor planner" };

export default function FloorPlannerPage() {
  return <FloorPlanner />;
}
