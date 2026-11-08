import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

const SITE_URL = siteUrl();

// Share images come from app/opengraph-image.png and app/twitter-image.png:
// Next.js adds the og:image / twitter:image tags (with type, size and a
// cache-busting hash) and makes them absolute using metadataBase.
export const metadata: Metadata = {
  metadataBase: SITE_URL,

  title: {
    default: "FindYourPortfolio",
    // Sub-pages read e.g. "Rankings · FindYourPortfolio".
    template: "%s · FindYourPortfolio",
  },
  description: "Discover, share and explore developer portfolios. Add yours and get discovered.",

  openGraph: {
    title: "FindYourPortfolio",
    description: "Discover amazing developer portfolios and share your own.",
    url: "/",
    siteName: "FindYourPortfolio",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "FindYourPortfolio",
    description: "Discover, share and explore developer portfolios.",
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
