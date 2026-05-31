import { RefineWorkbenchClient } from "@/components/refine/refine-workbench-client";
import * as React from "react";

export default function RefinePage() {
  return (
    <React.Suspense fallback={<div className="h-64" />}>
      <RefineWorkbenchClient />
    </React.Suspense>
  );
}
