import { Suspense } from "react";
import { StudioShell } from "@/components/studio-shell";
import { SupplierDashboard } from "@/components/supplier-dashboard";

export default function SuppliersPage() {
  return <Suspense fallback={<div className="min-h-svh bg-[#f4f6fb]" />}><StudioShell module="suppliers"><SupplierDashboard /></StudioShell></Suspense>;
}
