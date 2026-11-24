import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: "VivrePlay Market",
  openGraph: {
    type: "website",
    siteName: "VivrePlay Market",
    title: "VivrePlay Market",
    description: "Buy, sell, and bid on One Piece Card Game & Pokémon TCG singles, graded slabs, and sealed products.",
    images: [{ url: "/brand/vivreplay-market-og.png", width: 1200, height: 630, alt: "VivrePlay Market" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VivrePlay Market",
    description: "Buy, sell, and bid on One Piece Card Game & Pokémon TCG singles, graded slabs, and sealed products.",
    images: ["/brand/vivreplay-market-og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "VivrePlay Market",
    statusBarStyle: "default",
  },
  manifest: "/market.webmanifest?v=3",
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
