"use client";

import { useEffect, useState } from "react";
import type { AnalyticsDashboardPayload } from "@/types/contracts/analytics";
import { getAnalyticsDashboard } from "@/api/analytics";

export function useDashboardData() {
  const [data, setData] = useState<AnalyticsDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getAnalyticsDashboard()
      .then((payload) => {
        if (!alive) return;
        setData(payload);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return { data, isLoading, error };
}
