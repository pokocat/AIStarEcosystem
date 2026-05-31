"use client";
import { PipelineFrame } from "@/components/shell/pipeline-frame";
import { FinalizeStep } from "@/components/pipeline/finalize";

export default function Page() {
  return <PipelineFrame current="finalize">{(detail, reload) => <FinalizeStep detail={detail} reload={reload} />}</PipelineFrame>;
}
