"use client";
import { PipelineFrame } from "@/components/shell/pipeline-frame";
import { SamplingStep } from "@/components/pipeline/sampling";

export default function Page() {
  return <PipelineFrame current="sampling">{(detail, reload) => <SamplingStep detail={detail} reload={reload} />}</PipelineFrame>;
}
