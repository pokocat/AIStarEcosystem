import { describe, expect, it } from "vitest";
import type { StudioPlanExecution, StudioPlanExecutionStep } from "@ai-star-eco/types/ip-studio-workflow";
import { segmentedActive, segmentedPhases, segmentedResultStep, segmentedRecords } from "./studio-segmented";
import type { IpProject, IpRun } from "@ai-star-eco/types";

describe('长视频记录恢复', () => {
  const run = { id: 'script-run', createdAt: '2026-11-06T08:34:24Z', inputs: { executionId: 'PEX-original', segmented: { kind: 'script', scene: { duration: 24, ratio: '16:9' } } } } as unknown as IpRun;
  const project = (doc: IpProject['doc'] = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } }) => ({ name: '场景种草', doc, runs: { script: run }, runsById: { [run.id]: run } });
  it('recovers a missing row from accepted script runs without fabricating a resubmittable request', () => {
    const rows = segmentedRecords(project());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ executionId: 'PEX-original', title: '场景种草 · 24 秒', ratio: '16:9' });
    expect(rows[0].request).toBeUndefined();
  });
  it('keeps the saved request and does not duplicate its recovered execution', () => {
    const request = { clientRequestId: 'original', sceneId: 'ecom-seeding', duration: 24, ratio: '16:9', materials: [], budgetCap: 2432 };
    const doc = { ...project().doc, sceneSegmented: [{ executionId: 'PEX-original', clientRequestId: 'original', at: run.createdAt, title: '原始标题', request }] };
    expect(segmentedRecords(project(doc))).toEqual(doc.sceneSegmented);
  });
  it('does not treat ordinary text or review tasks as a new video', () => {
    const p = project();
    p.runs.script = { ...run, inputs: { executionId: 'PEX-original' } };
    p.runsById = { [run.id]: { ...run, inputs: { executionId: 'PEX-original', segmented: { kind: 'review' } } as never } };
    expect(segmentedRecords(p)).toEqual([]);
  });
});

const step = (id: string, operation: StudioPlanExecutionStep["operation"], status: StudioPlanExecutionStep["status"], reason?: string): StudioPlanExecutionStep =>
  ({ id, title: id, operation, stage: "production", dependsOn: [], status, runIds: [], attempt: 1, quotedCost: 0, ...(reason ? { reason } : {}) });
const execution = (status: StudioPlanExecution["status"], steps: StudioPlanExecutionStep[]): StudioPlanExecution =>
  ({ id: "e", projectId: "p", skillKey: "video-generation", skillVersion: 1, stage: "production", planRunId: "r", planRevision: 1, planFingerprint: "f", status, steps, budgets: [],
    startedAt: "", deadlineAt: "", updatedAt: "" });

describe("长视频的进度", () => {
  it("分镜图和它的检查算一个阶段，张数不含检查", () => {
    const phases = segmentedPhases(execution("running", [step("script", "text", "done"), step("review", "text", "done"),
      step("b1", "image", "done"), step("c1", "check", "running"), step("b2", "image", "pending"), step("c2", "check", "pending"),
      step("v1", "video", "pending"), step("v2", "video", "pending"), step("film", "assemble", "pending")]));
    expect(phases.map(p => p.key)).toEqual(["script", "review", "boards", "videos", "film"]);
    const boards = phases.find(p => p.key === "boards")!;
    expect([boards.done, boards.total, boards.state]).toEqual([1, 2, "running"]);
  });

  it("用不上的第二张分镜图不算进总数", () => {
    const boards = segmentedPhases(execution("running", [step("b1", "image", "done"), step("b1x", "image", "skipped", "一张分镜图放得下"), step("b2", "image", "done")])).find(p => p.key === "boards")!;
    expect([boards.done, boards.total, boards.state]).toEqual([2, 2, "done"]);
  });

  it("审核没做成跳过了，这一阶段算过去", () => {
    const review = segmentedPhases(execution("running", [step("review", "text", "skipped", "没有审成")])).find(p => p.key === "review")!;
    expect(review.state).toBe("done");
  });

  it("用户停止后没做的步骤不显示成做完了", () => {
    const phases = segmentedPhases(execution("canceled", [step("script", "text", "failed"), step("review", "text", "skipped"), step("b1", "image", "skipped"), step("v1", "video", "skipped"), step("film", "assemble", "skipped")]));
    expect(phases.filter(p => p.state === "done")).toEqual([]);
    const boards = phases.find(p => p.key === "boards")!;
    expect([boards.done, boards.total]).toEqual([0, 1]);
  });

  it("失败的阶段照实显示", () => {
    const videos = segmentedPhases(execution("needs_user", [step("v1", "video", "done"), step("v2", "video", "failed")])).find(p => p.key === "videos")!;
    expect([videos.done, videos.total, videos.state]).toEqual([1, 2, "failed"]);
  });

  it("结果是合成那一步；只有一段时是那段视频", () => {
    expect(segmentedResultStep(execution("done", [step("v1", "video", "done"), step("film", "assemble", "done")]))?.id).toBe("film");
    expect(segmentedResultStep(execution("done", [step("v1", "video", "done")]))?.id).toBe("v1");
  });

  it("暂停和等用户都算还没结束，做完和停止不算", () => {
    expect(segmentedActive(execution("paused", []))).toBe(true);
    expect(segmentedActive(execution("needs_user", []))).toBe(true);
    expect(segmentedActive(execution("done", []))).toBe(false);
    expect(segmentedActive(execution("canceled", []))).toBe(false);
  });
});
