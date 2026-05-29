import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Olive · Restaurant Dashboard",
  description: "Voice-AI ordering — kitchen view and menu management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <h1 className="text-xl font-semibold tracking-tight">
              Olive
            </h1>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="hover:underline">
                Kitchen
              </Link>
              <Link href="/menu" className="hover:underline">
                Menu / 86
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
