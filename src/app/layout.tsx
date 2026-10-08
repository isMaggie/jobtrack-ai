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
        <header className="border-b">
          <nav aria-label="Main navigation" className="mx-auto flex max-w-5xl gap-6 p-6">
            <Link className="font-semibold" href="/">JobTrack AI</Link>
            <Link className="text-blue-700 underline" href="/">Dashboard</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
