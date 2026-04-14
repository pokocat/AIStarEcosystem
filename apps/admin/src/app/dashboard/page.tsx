"use client";

import { useEffect, useState } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { DashboardStats } from "@/types";
import { apiFetch } from "@/lib/api";

const PLACEHOLDER_STATS: DashboardStats = {
  totalUsers: 0,
  activeTenants: 0,
  activeLicenses: 0,
  totalCreditsIssued: 0,
  products: 0,
  auditEvents: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(PLACEHOLDER_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await apiFetch<DashboardStats>("/api/admin/stats");
        setStats(data);
      } catch (err) {
        setError("Could not load stats from API. Showing placeholder data.");
        setStats({
          totalUsers: 1284,
          activeTenants: 342,
          activeLicenses: 891,
          totalCreditsIssued: 2450000,
          products: 12,
          auditEvents: 58432,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Platform overview and key metrics
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-yellow-600/30 bg-yellow-600/10 px-4 py-3 text-sm text-yellow-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
      ) : (
        <StatsCards stats={stats} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-1 font-semibold">Quick Links</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Jump to common admin tasks
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="/users" className="text-blue-400 hover:underline">
                Manage Users
              </a>
            </li>
            <li>
              <a href="/licenses" className="text-blue-400 hover:underline">
                Issue License Batches
              </a>
            </li>
            <li>
              <a href="/entitlements" className="text-blue-400 hover:underline">
                View Entitlements
              </a>
            </li>
            <li>
              <a href="/audit" className="text-blue-400 hover:underline">
                Review Audit Logs
              </a>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-1 font-semibold">API Status</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Backend connectivity
          </p>
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                error ? "bg-red-500" : loading ? "bg-yellow-500" : "bg-green-500"
              }`}
            />
            <span className="text-sm">
              {loading
                ? "Connecting..."
                : error
                ? "Unavailable — using placeholder data"
                : "Connected to http://localhost:8080"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
