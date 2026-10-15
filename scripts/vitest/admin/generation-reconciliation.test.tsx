import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GenerationTaskReconciliation, MaterialVideoReconciliation } from "../../../apps/admin/src/app/platform/ai-models/material-video-reconciliation";
import { StudioImageReconciliation } from "../../../apps/admin/src/app/platform/ai-models/studio-image-reconciliation";
import type { MaterialVideoReconciliationCard, StudioImageReconciliationCard } from "../../../apps/admin/src/types/material-video-reconciliation";

const api = vi.hoisted(() => ({ read: vi.fn(), reconcile: vi.fn(), readImage: vi.fn(), reconcileImage: vi.fn(), releaseUnknownImage: vi.fn() }));
vi.mock("@/api/material-video-reconciliation", () => api);

const evidence = "供应商工单 LOCAL-123：已于 2026-10-15 核对原请求。";
const video: MaterialVideoReconciliationCard = { id: "video-local", status: "rendering", error_code: "VIDEO_SUBMISSION_UNKNOWN" };
const image: StudioImageReconciliationCard = {
  id: "image-local", ownerUserId: "owner", projectId: "project", endpointId: "image-model", status: "running", stage: "generating",
  cost: 8, holdTotal: 16, errorCode: "STUDIO_IMAGE_SUBMISSION_UNKNOWN",
  images: [
    { imageIndex: 0, submitAttempted: true, externalTaskId: "completed_image", mirrored: true },
    { imageIndex: 1, submitAttempted: true, externalTaskId: "", mirrored: false },
    { imageIndex: 2, submitAttempted: false, externalTaskId: "", mirrored: false },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  api.read.mockResolvedValue(video);
  api.reconcile.mockResolvedValue({ ...video, status: "failed", error_code: "VIDEO_CONFIRMED_NOT_ACCEPTED" });
  api.readImage.mockResolvedValue(image);
  api.reconcileImage.mockResolvedValue({ ...image, errorCode: "STUDIO_IMAGE_RECOVERING" });
  api.releaseUnknownImage.mockResolvedValue({ ...image, status: "failed", errorCode: "STUDIO_IMAGE_CONFIRMED_NOT_ACCEPTED" });
});
afterEach(cleanup);

async function readVideo() {
  fireEvent.change(screen.getByRole("textbox", { name: "我方视频任务编号" }), { target: { value: " video-local " } });
  fireEvent.click(screen.getByRole("button", { name: "查询原任务", exact: true }));
  await screen.findByRole("textbox", { name: "核对依据" });
  expect(api.read).toHaveBeenCalledWith("video-local");
}
async function readImage() {
  fireEvent.change(screen.getByRole("textbox", { name: "我方图片运行记录编号" }), { target: { value: " image-local " } });
  fireEvent.click(screen.getByRole("button", { name: "查询原图片任务", exact: true }));
  await screen.findByRole("textbox", { name: "核对依据" });
  expect(api.readImage).toHaveBeenCalledWith("image-local");
}
function fillEvidence(value = evidence) {
  fireEvent.change(screen.getByRole("textbox", { name: "核对依据" }), { target: { value } });
}

describe("video original-task recovery", () => {
  test("requires valid original ID and evidence, then explicit review confirmation before sending the original payload", async () => {
    render(<MaterialVideoReconciliation />);
    await readVideo();
    const submit = screen.getByRole("button", { name: "核对补录信息" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fillEvidence("short");
    fireEvent.change(screen.getByRole("textbox", { name: "原厂商任务号" }), { target: { value: "supplier.task:123" } });
    expect(submit.disabled).toBe(true);
    fillEvidence(` ${evidence} `);
    fireEvent.change(screen.getByRole("textbox", { name: "原厂商任务号" }), { target: { value: "invalid/task" } });
    fireEvent.click(submit);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.reconcile).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "原厂商任务号" }), { target: { value: " supplier.task:123 " } });
    fireEvent.click(submit);
    let review = await screen.findByRole("dialog");
    expect(api.reconcile).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "返回修改" }));
    expect(api.reconcile).not.toHaveBeenCalled();
    fireEvent.click(submit);
    review = await screen.findByRole("dialog");
    fireEvent.click(within(review).getByRole("button", { name: "确认并核对原任务" }));
    await waitFor(() => expect(api.reconcile).toHaveBeenCalledExactlyOnceWith("video-local", { externalTaskId: "supplier.task:123", evidence }));
  });

  test("release needs supplier confirmation plus evidence and sends no replacement task ID", async () => {
    render(<MaterialVideoReconciliation />);
    await readVideo();
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    const release = screen.getByRole("button", { name: "核对未受理依据与积分退回" }) as HTMLButtonElement;
    fillEvidence();
    expect(release.disabled).toBe(true);
    fireEvent.click(checkbox);
    expect(release.disabled).toBe(false);
    fireEvent.click(release);
    const review = await screen.findByRole("dialog");
    expect(api.reconcile).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "确认未受理并退回冻结积分" }));
    await waitFor(() => expect(api.reconcile).toHaveBeenCalledExactlyOnceWith("video-local", { confirmedNotAccepted: true, evidence }));
  });

  test("an entered supplier ID disables the mutually exclusive no-task release path", async () => {
    render(<MaterialVideoReconciliation />);
    await readVideo();
    fillEvidence();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("textbox", { name: "原厂商任务号" }), { target: { value: "accepted-task-123" } });
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    const release = screen.getByRole("button", { name: "核对未受理依据与积分退回" }) as HTMLButtonElement;
    expect(release.disabled).toBe(true);
    fireEvent.click(release);
    expect(api.reconcile).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a known supplier ID only offers querying that original task and never no-task release", async () => {
    api.read.mockResolvedValue({ ...video, external_task_id: "accepted-task-123" });
    render(<MaterialVideoReconciliation />);
    fireEvent.change(screen.getByRole("textbox", { name: "我方视频任务编号" }), { target: { value: "video-local" } });
    fireEvent.click(screen.getByRole("button", { name: "查询原任务", exact: true }));
    const query = await screen.findByRole("button", { name: "核对原厂商任务结果" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "原厂商任务号" })).toBeNull();
    fireEvent.click(query);
    await waitFor(() => expect(api.reconcile).toHaveBeenCalledExactlyOnceWith("video-local", undefined));
  });

  test("failed release preserves its review payload for retry and blocks duplicate in-flight submissions", async () => {
    api.reconcile.mockRejectedValueOnce(new Error("LOCAL_REVIEW_RETRY"));
    let finish: (value: MaterialVideoReconciliationCard) => void = () => {};
    api.reconcile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<MaterialVideoReconciliation />);
    await readVideo(); fillEvidence(); fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "核对未受理依据与积分退回" }));
    const review = await screen.findByRole("dialog");
    fireEvent.click(within(review).getByRole("button", { name: "确认未受理并退回冻结积分" }));
    expect(await within(review).findByRole("alert")).toBeDefined();
    const confirm = within(review).getByRole("button", { name: "确认未受理并退回冻结积分" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(api.reconcile).toHaveBeenCalledTimes(2);
    expect(api.reconcile.mock.calls[0]).toEqual(api.reconcile.mock.calls[1]);
    await act(async () => finish({ ...video, status: "failed", error_code: "VIDEO_CONFIRMED_NOT_ACCEPTED" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("image candidate recovery", () => {
  test("targets the attempted, unmirrored candidate and reviews original ID/evidence before mutation", async () => {
    render(<StudioImageReconciliation />);
    await readImage();
    fillEvidence();
    const original = screen.getByRole("textbox", { name: "原厂商图片任务号" });
    fireEvent.change(original, { target: { value: "invalid.task" } });
    fireEvent.click(screen.getByRole("button", { name: "核对图片补录信息" }));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(api.reconcileImage).not.toHaveBeenCalled();
    fireEvent.change(original, { target: { value: " accepted_image-123 " } });
    fireEvent.click(screen.getByRole("button", { name: "核对图片补录信息" }));
    const review = await screen.findByRole("dialog");
    expect(api.reconcileImage).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "确认并核对原图片任务" }));
    await waitFor(() => expect(api.reconcileImage).toHaveBeenCalledExactlyOnceWith("image-local", { imageIndex: 1, externalTaskId: "accepted_image-123", evidence }));
    expect(api.releaseUnknownImage).not.toHaveBeenCalled();
  });

  test("unknown candidate release requires both evidence and explicit confirmation and retains the candidate index", async () => {
    render(<StudioImageReconciliation />);
    await readImage();
    const release = screen.getByRole("button", { name: "核对未受理依据与积分退回" }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole("checkbox"));
    expect(release.disabled).toBe(true);
    fillEvidence();
    fireEvent.click(release);
    const review = await screen.findByRole("dialog");
    expect(api.releaseUnknownImage).not.toHaveBeenCalled();
    fireEvent.click(within(review).getByRole("button", { name: "返回核对" }));
    expect(api.releaseUnknownImage).not.toHaveBeenCalled();
    fireEvent.click(release);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "确认未受理并退回冻结积分" }));
    await waitFor(() => expect(api.releaseUnknownImage).toHaveBeenCalledExactlyOnceWith("image-local", { imageIndex: 1, evidence, confirmedNoUpstreamTask: true }));
    expect(api.reconcileImage).not.toHaveBeenCalled();
  });

  test("known image supplier ID is read-only and never exposes no-task release", async () => {
    api.readImage.mockResolvedValue({ ...image, images: [{ imageIndex: 0, submitAttempted: true, externalTaskId: "accepted_image-123", mirrored: false }] });
    render(<StudioImageReconciliation />);
    await readImage();
    const original = screen.getByRole("textbox", { name: "原厂商图片任务号" }) as HTMLInputElement;
    expect(original.readOnly).toBe(true);
    expect(original.value).toBe("accepted_image-123");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "核对未受理依据与积分退回" })).toBeNull();
    fillEvidence();
    fireEvent.click(screen.getByRole("button", { name: "核对原图片任务", exact: true }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "确认并核对原图片任务" }));
    await waitFor(() => expect(api.reconcileImage).toHaveBeenCalledExactlyOnceWith("image-local", { imageIndex: 0, externalTaskId: "accepted_image-123", evidence }));
  });

  test("unattempted images and settled tasks do not offer recovery or release", async () => {
    api.readImage.mockResolvedValue({ ...image, status: "done", images: [image.images[0], image.images[2]] });
    render(<StudioImageReconciliation />);
    fireEvent.change(screen.getByRole("textbox", { name: "我方图片运行记录编号" }), { target: { value: "image-local" } });
    fireEvent.click(screen.getByRole("button", { name: "查询原图片任务", exact: true }));
    await screen.findByRole("button", { name: "刷新图片任务状态" });
    expect(screen.queryByRole("textbox", { name: "原厂商图片任务号" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(api.reconcileImage).not.toHaveBeenCalled();
    expect(api.releaseUnknownImage).not.toHaveBeenCalled();
  });
});

test("the mounted task-kind switch exposes each real recovery form", async () => {
  render(<GenerationTaskReconciliation />);
  expect(screen.getByRole("textbox", { name: "我方视频任务编号" })).toBeDefined();
  const group = screen.getByRole("group", { name: "核对任务类型" });
  fireEvent.click(within(group).getByRole("button", { name: "图片任务核对" }));
  expect(screen.queryByRole("textbox", { name: "我方视频任务编号" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "我方图片运行记录编号" })).toBeDefined();
  fireEvent.click(within(group).getByRole("button", { name: "视频任务核对" }));
  expect(screen.queryByRole("textbox", { name: "我方图片运行记录编号" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "我方视频任务编号" })).toBeDefined();
});
