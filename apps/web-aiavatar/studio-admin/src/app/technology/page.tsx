import { Suspense } from "react";
import { StudioShell } from "@/components/studio-shell";
import { StudioDashboard } from "@/components/studio-dashboard";

export default function TechnologyPage() {
  return <Suspense fallback={<div className="min-h-svh bg-[#f4f6fb]" />}><StudioShell module="technology"><StudioDashboard module="technology" /></StudioShell></Suspense>;
}
