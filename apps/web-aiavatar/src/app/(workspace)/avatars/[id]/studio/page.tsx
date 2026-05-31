"use client";
import { PipelineFrame } from "@/components/shell/pipeline-frame";
import { StudioStep } from "@/components/pipeline/studio";

export default function Page() {
  return <PipelineFrame current="studio">{(detail, reload) => <StudioStep detail={detail} reload={reload} />}</PipelineFrame>;
}
