import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PWAControls } from "@/components/providers/PWAControls";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "Spendly",
  title: "Spendly — Full-Stack Personal Finance Management",
  description:
    "Take control of your money with multi-currency tracking, intelligent monthly budgeting, and deep financial reporting.",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Spendly",
  },
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2878E5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen bg-[#F3F6FC] text-[#202735]`}>
        <PWAControls />
        {children}
      </body>
    </html>
  );
}
