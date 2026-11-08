import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "FindYourPortfolio — developer portfolios to inspire your next build",
    template: "%s · FindYourPortfolio",
  },
  description:
    "A browsable directory of real developer portfolio sites with live previews, weekly and yearly rankings, and community submissions.",
  openGraph: {
    title: "FindYourPortfolio",
    description: "Browse, preview and rank real developer portfolios. Add your own.",
    type: "website",
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
          <span>
            Data sourced from the community-maintained{" "}
            <a href="https://github.com/Furqan-7/FindYourPortfolio" target="_blank" rel="noopener noreferrer">
              FindYourPortfolio
            </a>{" "}
            collection on GitHub.
          </span>
          <span>Built for browsing, not tracking — no sign-up required.</span>
        </footer>
      </body>
    </html>
  );
}
