import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "JobTrack AI",
  description: "Track your job applications in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <Link className="rounded-sm text-lg font-bold tracking-tight" href="/">JobTrack AI</Link>
            <Link className="text-link text-sm" href="/">Dashboard</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
