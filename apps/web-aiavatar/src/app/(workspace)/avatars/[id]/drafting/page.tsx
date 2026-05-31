"use client";
import { PipelineFrame } from "@/components/shell/pipeline-frame";
import { DraftingStep } from "@/components/pipeline/drafting";

export default function Page() {
  return <PipelineFrame current="drafting">{(detail, reload) => <DraftingStep detail={detail} reload={reload} />}</PipelineFrame>;
}
