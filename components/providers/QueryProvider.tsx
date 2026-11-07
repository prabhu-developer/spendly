"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";

interface InitialCategory {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}

export function QueryProvider({
  children,
  initialCategories,
}: {
  children: ReactNode;
  initialCategories: InitialCategory[];
}) {
  const [queryClient] = useState(
    () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            gcTime: 1000 * 60,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      });

      client.setQueryData(["categories"], initialCategories);
      client.setQueryDefaults(["categories"], { staleTime: 60_000 });
      client.setQueryDefaults(["currentUser"], { staleTime: 60_000 });
      return client;
    }
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
