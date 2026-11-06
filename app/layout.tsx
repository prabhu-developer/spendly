import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spendly — Full-Stack Personal Finance Management",
  description:
    "Take control of your money with multi-currency tracking, intelligent monthly budgeting, and deep financial reporting.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen bg-[#F3F6FC] text-[#202735]`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
