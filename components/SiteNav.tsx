"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo, GitHubIcon } from "./Icons";

const LINKS = [
  { href: "/", label: "Browse" },
  { href: "/rankings", label: "Rankings" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="top-nav" aria-label="Main">
      <Link className="wordmark" href="/">
        <BrandLogo className="brand-logo" width={24} height={24} />
        <span>findyourportfolio</span>
      </Link>
      <div className="nav-right">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${pathname === l.href ? " active" : ""}`}
            aria-current={pathname === l.href ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
        <a
          className="nav-link nav-github"
          href="https://github.com/Furqan-7/FindYourPortfolio"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Source on GitHub"
          title="Source on GitHub"
        >
          <GitHubIcon width={18} height={18} />
        </a>
        <Link href="/submit" className={`btn btn-primary btn-sm nav-cta${pathname === "/submit" ? " active" : ""}`}>
          <span className="nav-cta-long">Add your portfolio</span>
          <span className="nav-cta-short">+ Add</span>
        </Link>
      </div>
    </nav>
  );
}
