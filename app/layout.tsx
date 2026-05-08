import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { DataFileWatcher } from "@/components/data-file-watcher";
import { TestingBanner } from "@/components/testing-banner";
import { ThemeProvider } from "@/components/theme-provider";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-heading", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Oli Healthy — Operations",
  description: "Internal operations dashboard for Oli Healthy meal subscriptions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex flex-col h-full">
        <ThemeProvider>
          <TestingBanner />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6 bg-background">{children}</main>
          </div>
          <DataFileWatcher />
        </ThemeProvider>
      </body>
    </html>
  );
}
