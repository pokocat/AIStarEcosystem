"use client";
import { PipelineFrame } from "@/components/shell/pipeline-frame";
import { OutputStep } from "@/components/pipeline/output";

export default function Page() {
  return <PipelineFrame current="output">{(detail, reload) => <OutputStep detail={detail} reload={reload} />}</PipelineFrame>;
}
