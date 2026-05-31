"use client";
import { PipelineFrame } from "@/components/shell/pipeline-frame";
import { MaterialStep } from "@/components/pipeline/material";

export default function Page() {
  return <PipelineFrame current="material">{(detail, reload) => <MaterialStep detail={detail} reload={reload} />}</PipelineFrame>;
}
