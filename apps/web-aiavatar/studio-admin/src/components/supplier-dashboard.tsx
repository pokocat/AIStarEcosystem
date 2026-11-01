"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@ai-star-eco/ui/ui/skeleton";

const SupplierPerformancePanel = dynamic(
  () => import("./supplier-performance").then((module) => module.SupplierPerformancePanel),
  { ssr: false, loading: () => <div className="space-y-4"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div> },
);

export function SupplierDashboard() {
  const search = useSearchParams();
  const demo = process.env.NODE_ENV !== "production" && search.get("demo") === "1";
  const mode = search.get("tab") === "details" ? "details" : "overview";
  return <div className="mx-auto max-w-[1760px] px-3 py-3 sm:px-4 md:px-5 md:py-4 xl:px-6"><SupplierPerformancePanel demo={demo} mode={mode} /></div>;
}
