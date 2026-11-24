import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = {
  title: "Tile previews and image packs",
  openGraph: {
    title: "MyTilesTrial — See every tile before it's laid",
    description: "Preview tiles in real rooms and choose an image pack for your next project.",
  },
};

export default function LandingPage() {
  return <MarketingPage paidOnly />;
}
