"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useProducerWorkspace } from "@/features/producer/hooks/use-producer-workspace";
import { ErrorPanel, LoadingPanel } from "@/features/shared/components/page-feedback";

const AIIncubator = dynamic(() => import("@/components/AIIncubator").then((module) => module.AIIncubator), {
  ssr: false,
  loading: () => <LoadingPanel label="Loading AI incubator..." />
});

export default function ProducerIncubatorRoute() {
  const router = useRouter();
  const workspace = useProducerWorkspace();

  if (workspace.errors.length) {
    return <ErrorPanel title="Failed to load AI incubator" detail={workspace.errors[0]} />;
  }

  if (workspace.isBootstrapping || !workspace.singerWorkspace) {
    return <LoadingPanel label="Loading AI incubator..." />;
  }

  return (
    <AIIncubator
      lang="en"
      singers={workspace.singerWorkspace.singers}
      officialIpTemplates={workspace.singerWorkspace.officialIpTemplates}
      personaPresets={workspace.singerWorkspace.personaPresets}
      wardrobeCatalog={workspace.singerWorkspace.wardrobeCatalog}
      poseCatalog={workspace.singerWorkspace.poseCatalog}
      expressionCatalog={workspace.singerWorkspace.expressionCatalog}
      gestureCatalog={workspace.singerWorkspace.gestureCatalog}
      onBack={() => router.push("/producer/overview")}
      onCreateSinger={workspace.createSinger}
      onUpdateSinger={workspace.updateSinger}
      onDeleteSinger={workspace.deleteSinger}
    />
  );
}
