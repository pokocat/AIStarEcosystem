import { Suspense } from "react";
import { StudioShell } from "@/components/studio-shell";
import { StudioDashboard } from "@/components/studio-dashboard";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#f4f6fb]" />}>
      <StudioShell>
        <StudioDashboard />
      </StudioShell>
    </Suspense>
  );
}
