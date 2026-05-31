"use client";
import { PipelineFrame } from "@/components/shell/pipeline-frame";
import { DeriveStep } from "@/components/pipeline/derive";

export default function Page() {
  return <PipelineFrame current="derive">{(detail, reload) => <DeriveStep detail={detail} reload={reload} />}</PipelineFrame>;
}
