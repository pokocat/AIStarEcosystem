import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { Script, ScriptVersion } from "@ai-star-eco/types/script";

// 脚本编辑器页的行为（v0.197 第三轮评审复核，§8.0.1 ⑩：断行为不断文案）：
//   · 「保存并复制」只复制一份：保存后不再重拉本页数据（重拉会让整页进 loading、确认弹窗被卸掉再挂回来）；
//   · 复制期间正文只读，跳走前不会有新打的字被丢下；
//   · 正文第一次没读出来：给重试，不显示空编辑器；
//   · 保存后缓存被清、重拉又失败：之后的改动仍算「没保存」，保存按钮仍可点。
// 按钮按 data-script-action 取，编辑器按 aria-label 取，不按可视文字。

const getScript = vi.fn();
const listVersionsByScript = vi.fn();
const commitVersion = vi.fn();
const cloneScript = vi.fn();
vi.mock("@/api", () => ({
  ScriptsApi: {
    getScript: (...a: unknown[]) => getScript(...a),
    listVersionsByScript: (...a: unknown[]) => listVersionsByScript(...a),
    commitVersion: (...a: unknown[]) => commitVersion(...a),
    cloneScript: (...a: unknown[]) => cloneScript(...a),
    deleteScript: vi.fn(),
    generateDraft: vi.fn(),
  },
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ScriptEditorPage from "./page";
import { clearAll, invalidate } from "@/lib/drama-query";

const SCRIPT: Script = {
  id: "ds_1",
  title: "第一集",
  kind: "drama",
  status: "approved",
  currentVersionId: "ds_1:current",
  progress: 100,
  createdAt: "2026-09-28T01:00:00Z",
  updatedAt: "2026-09-28T01:00:00Z",
  authorName: "我",
};
const version = (content: string, at = "2026-09-28T01:00:00Z"): ScriptVersion => ({
  id: "ds_1:current",
  scriptId: "ds_1",
  version: 1,
  content,
  authorName: "我",
  aiAssisted: false,
  createdAt: at,
  note: "当前稿",
});
const COPY: Script = { ...SCRIPT, id: "ds_copy", title: "第一集（副本）" };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

async function mount() {
  const params = Promise.resolve({ scriptId: "ds_1" });
  let view!: ReturnType<typeof render>;
  // 页面用 React.use(params)，首帧会挂起：render 要包在 await 的 act 里
  await act(async () => {
    view = render(
      <React.Suspense fallback={null}>
        <ScriptEditorPage params={params} />
      </React.Suspense>,
    );
  });
  await flush();
  return view;
}

const editor = (c: HTMLElement) => c.querySelector<HTMLTextAreaElement>('textarea[aria-label="脚本正文"]');
const action = (c: HTMLElement, name: string) =>
  c.querySelector<HTMLButtonElement>(`[data-script-action="${name}"]`)!;
/** 确认弹窗里的主按钮（底栏最后一个）。弹窗渲染在组件树里，不走 portal。 */
const dialogConfirm = (c: HTMLElement) => {
  const buttons = c.querySelectorAll<HTMLButtonElement>('[role="dialog"] button');
  return buttons[buttons.length - 1];
};

beforeEach(() => {
  clearAll();
  getScript.mockReset().mockResolvedValue(SCRIPT);
  listVersionsByScript.mockReset().mockResolvedValue([version("原文")]);
  commitVersion.mockReset();
  cloneScript.mockReset();
  push.mockReset();
});
afterEach(() => {
  cleanup();
});

describe("脚本编辑器 · 复制成新脚本", () => {
  it("有改动时「保存并复制」：保存后不重拉、弹窗不被卸掉，最后只复制一份", async () => {
    const { container } = await mount();
    fireEvent.change(editor(container)!, { target: { value: "改过的正文" } });

    fireEvent.click(action(container, "duplicate"));
    await flush();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    const clone = deferred<Script>();
    commitVersion.mockResolvedValue(version("改过的正文", "2026-09-28T02:00:00Z"));
    cloneScript.mockReturnValue(clone.promise);
    fireEvent.click(dialogConfirm(container));
    await flush();

    // 保存已成功、复制还在跑：页面没有退回加载态，弹窗还在、按钮不可再点
    expect(commitVersion).toHaveBeenCalledTimes(1);
    expect(editor(container)).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(dialogConfirm(container).disabled).toBe(true);
    expect(getScript).toHaveBeenCalledTimes(1);
    expect(listVersionsByScript).toHaveBeenCalledTimes(1);

    // 再点一次也不会发第二个复制请求
    fireEvent.click(dialogConfirm(container));
    fireEvent.click(action(container, "duplicate"));
    await flush();
    expect(cloneScript).toHaveBeenCalledTimes(1);
    expect(cloneScript).toHaveBeenCalledWith("ds_1", { content: "改过的正文" });

    clone.resolve(COPY);
    await flush();
    expect(cloneScript).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/scripts/ds_copy");
  });

  it("复制期间正文只读；跳往副本前「复制中」一直保持", async () => {
    const { container } = await mount();
    const clone = deferred<Script>();
    cloneScript.mockReturnValue(clone.promise);

    fireEvent.click(action(container, "duplicate"));
    await flush();
    expect(editor(container)!.readOnly).toBe(true);
    expect(action(container, "save").disabled).toBe(true);

    clone.resolve(COPY);
    await flush();
    expect(push).toHaveBeenCalledWith("/scripts/ds_copy");
    // 跳转完成前仍然只读、复制按钮仍在转圈：这段时间打的字不会被丢下，也点不出第二份
    expect(editor(container)!.readOnly).toBe(true);
    fireEvent.click(action(container, "duplicate"));
    await flush();
    expect(cloneScript).toHaveBeenCalledTimes(1);
  });

  it("复制失败：留在原页，正文恢复可编辑，改动还在", async () => {
    const { container } = await mount();
    fireEvent.change(editor(container)!, { target: { value: "改过的正文" } });
    fireEvent.click(action(container, "duplicate"));
    await flush();
    commitVersion.mockResolvedValue(version("改过的正文", "2026-09-28T02:00:00Z"));
    cloneScript.mockRejectedValue(new Error("HTTP 500"));
    fireEvent.click(dialogConfirm(container));
    await flush();

    expect(push).not.toHaveBeenCalled();
    expect(editor(container)!.readOnly).toBe(false);
    expect(editor(container)!.value).toBe("改过的正文");
  });
});

describe("脚本编辑器 · 正文读取与保存状态", () => {
  it("正文第一次没读出来：不显示编辑器，给重试；重试成功后编辑器里是服务端那份", async () => {
    listVersionsByScript.mockReset().mockRejectedValueOnce(new Error("HTTP 502")).mockResolvedValue([version("原文")]);
    const { container } = await mount();

    expect(editor(container)).toBeNull();
    const retry = Array.from(container.querySelectorAll("button")).find((b) => b.querySelector("svg.lucide-refresh-cw"));
    expect(retry).toBeTruthy();

    fireEvent.click(retry!);
    await flush();
    expect(editor(container)!.value).toBe("原文");
    expect(action(container, "duplicate").disabled).toBe(false);
  });

  it("保存后缓存被清、重拉失败：之后的改动仍算没保存，保存按钮可点", async () => {
    const { container } = await mount();
    fireEvent.change(editor(container)!, { target: { value: "第一次改" } });
    commitVersion.mockResolvedValue(version("第一次改", "2026-09-28T02:00:00Z"));
    fireEvent.click(action(container, "save"));
    await flush();
    expect(action(container, "save").disabled).toBe(true); // 刚存完：没有改动

    // 别处把正文缓存清掉、重拉又失败
    listVersionsByScript.mockRejectedValue(new Error("HTTP 502"));
    await act(async () => invalidate("/me/scripts/ds_1/versions"));
    await flush();

    fireEvent.change(editor(container)!, { target: { value: "第一次改，又改了" } });
    await flush();
    expect(editor(container)).not.toBeNull();
    expect(action(container, "save").disabled).toBe(false);
  });
});
