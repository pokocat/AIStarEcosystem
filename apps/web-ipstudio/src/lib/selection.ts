import type { IpCandidate, IpNode, IpRun } from "@ai-star-eco/types";

/**
 * 解析一个 generate 节点当前「定稿」的那张候选图。
 * 选中的候选可能来自更早的一次运行，所以要在 runsById 里按 selectedRunId 找。
 */
export function resolveSelectedCandidate(
  node: IpNode & { type: "generate" },
  runsById: Record<string, IpRun>,
): { candidate: IpCandidate; runId: string; index: number } | null {
  const { selectedRunId, selectedIndex } = node.data;
  if (!selectedRunId || typeof selectedIndex !== "number") return null;
  const run = runsById[selectedRunId];
  const candidate = run?.output.candidates?.[selectedIndex];
  if (!candidate) return null;
  return { candidate, runId: selectedRunId, index: selectedIndex };
}
