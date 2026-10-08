import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Wardrobe",
  description: "Your personal wardrobe, outfit studio, and style log.",
};

function NavLink({ href, label }: { href: string; label: string }) {
  return <Link href={href}>{label}</Link>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="nav-brand" style={{ textDecoration: "none" }}>
              My Wardrobe
            </Link>
            <div className="nav-links">
              <NavLink href="/" label="Studio" />
              <NavLink href="/closet" label="Closet" />
              <NavLink href="/looks" label="Looks" />
            </div>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
