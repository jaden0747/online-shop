import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { DataFileWatcher } from "@/components/data-file-watcher";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oli Healthy — Operations",
  description: "Internal operations dashboard for Oli Healthy meal subscriptions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 bg-background">{children}</main>
        <DataFileWatcher />
      </body>
    </html>
  );
}
