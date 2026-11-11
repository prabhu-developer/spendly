import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Spendly — Personal Finance",
    short_name: "Spendly",
    description: "Track your income, expenses, budgets, and financial goals.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    categories: ["finance", "productivity"],
    orientation: "portrait",
    background_color: "#F3F6FC",
    theme_color: "#2878E5",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192x192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Add transaction",
        short_name: "Add",
        description: "Record a new income or expense",
        url: "/dashboard/transactions/new",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Transactions",
        url: "/dashboard/transactions",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Reports",
        url: "/dashboard/reports",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
