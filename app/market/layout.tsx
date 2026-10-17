import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: "VivrePlay Market",
  appleWebApp: {
    capable: true,
    title: "VivrePlay Market",
    statusBarStyle: "default",
  },
  manifest: "/market.webmanifest?v=2",
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
