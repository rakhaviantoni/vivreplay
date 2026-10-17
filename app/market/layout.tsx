import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/market.webmanifest",
  icons: {
    icon: [
      { url: "/brand/vivreplay-market-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/vivreplay-market-icon-512.png", type: "image/png", sizes: "512x512" },
      { url: "/brand/vivreplay-market-icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{ url: "/brand/vivreplay-market-icon-192.png", type: "image/png", sizes: "192x192" }],
  },
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
