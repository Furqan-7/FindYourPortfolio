import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://findyourportfolio.vercel.app"),

  title: {
    default: "FindYourPortfolio",
    // Sub-pages read e.g. "Rankings · FindYourPortfolio".
    template: "%s · FindYourPortfolio",
  },
  description: "Discover, share and explore developer portfolios. Add yours and get discovered.",

  openGraph: {
    title: "FindYourPortfolio",
    description: "Discover amazing developer portfolios and share your own.",
    url: "https://findyourportfolio.vercel.app",
    siteName: "FindYourPortfolio",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FindYourPortfolio",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "FindYourPortfolio",
    description: "Discover, share and explore developer portfolios.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f7f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <SiteNav />
        {children}
        <footer className="footer">
          <div className="footer-inner">
            <span>
              Data sourced from the community-maintained{" "}
              <a href="https://github.com/Furqan-7/FindYourPortfolio" target="_blank" rel="noopener noreferrer">
                FindYourPortfolio
              </a>{" "}
              collection on GitHub.
            </span>
            <span>Built for browsing, not tracking — no sign-up required.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
