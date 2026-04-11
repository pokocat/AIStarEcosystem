"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProducerWorkspace } from "@/features/producer/hooks/use-producer-workspace";
import { ErrorPanel, LoadingPanel } from "@/features/shared/components/page-feedback";

const DistributionPage = dynamic(() => import("@/components/DistributionPage"), {
  ssr: false,
  loading: () => <LoadingPanel label="Loading distribution center..." />
});

export default function ProducerDistributionRoute() {
  const workspace = useProducerWorkspace();
  const [publishState, setPublishState] = useState<string | null>(null);

  if (workspace.errors.length) {
    return <ErrorPanel title="Failed to load distribution center" detail={workspace.errors[0]} />;
  }

  if (workspace.isBootstrapping || !workspace.trackWorkspace || !workspace.dashboard) {
    return <LoadingPanel label="Loading distribution center..." />;
  }

  return (
    <div className="space-y-6">
      {publishState ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Distribution request submitted.</span>
          <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">{publishState}</Badge>
        </div>
      ) : null}

      <DistributionPage
        songs={workspace.trackWorkspace.tracks}
        lang="en"
        channels={workspace.dashboard.distribution.channels}
        accountBindings={workspace.dashboard.distribution.accountBindings}
        onSubmit={async (request) => {
          const response = await workspace.publishDistribution(request);
          setPublishState(response.publishJobId);
        }}
      />
    </div>
  );
}
