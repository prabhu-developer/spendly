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

interface InitialUser {
  userId: string;
  email: string;
  name: string;
  preferredCurrency: string;
}

export function QueryProvider({
  children,
  initialCategories,
  initialUser,
}: {
  children: ReactNode;
  initialCategories: InitialCategory[];
  initialUser: InitialUser;
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

      client.setQueryDefaults(["categories"], { staleTime: 60_000 });
      client.setQueryDefaults(["currentUser"], { staleTime: 60_000 });
      client.setQueryData(["categories"], initialCategories);
      client.setQueryData(["currentUser"], initialUser);
      return client;
    }
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
