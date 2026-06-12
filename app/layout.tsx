import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ResultStack · NACS 2026 Booth Dashboard",
  description: "Internal planning dashboard for ResultStack booth C6059 at NACS 2026, Oct 6–9, Las Vegas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
