"use client";

import dynamic from "next/dynamic";

/** The 3D viewer, loaded (with three.js) only when someone opens it. */
export const LookAroundDialog = dynamic(() => import("@/components/fx/LookAround").then((m) => m.LookAround), { ssr: false });

export { preloadDepthModel } from "@/lib/depth";
