import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  __resetWorkbenchDocs,
  adoptServerDoc,
  commitWorkbenchDoc,
  fetchWorkbenchDoc,
  getWorkbenchDoc,
  trackWorkbenchSave,
  useWorkbenchDoc,
} from "./doc-store";
import type { ProjectData } from "@/mocks/drama-workshop";

// 工作台文档仓（v0.197 复核）。断文档里有什么（§8.0.1 ⑩）。
// 背景：回到列表再点进同一部，页面以前按 useAsync 缓存（第一次打开时读到的那份）初始化。

const DOC: ProjectData = {
  projectInfo: { title: "T", type: "都市", episodes: 3, duration: "每集 60 秒", ratio: "9:16", logline: "", mainline: "" },
  topicCards: [],
  episodes: [{ no: 1, content: "E1" }],
  characters: [],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
};

const serverRead = (doc: ProjectData) => fetchWorkbenchDoc("p", async () => ({ meta: {}, data: doc }));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("工作台文档仓", () => {
  beforeEach(() => __resetWorkbenchDocs());

  it("回到列表再点进来：缓存里那份（第一次打开时读的）不会盖掉上次存下的东西", async () => {
    const first = await serverRead(DOC); // 第一次打开，缓存里存着它
    adoptServerDoc("p", first, first.data);
    const scenes = [{ id: "s1", name: "天台", mood: "" }];
    commitWorkbenchDoc("p", { ...DOC, scenes }); // 第一次打开时加了一个场景

    // 再点进来：useAsync 先把缓存那份给页面
    adoptServerDoc("p", first, first.data);
    expect(getWorkbenchDoc("p")?.scenes).toBe(scenes);
  });

  it("已卸载页面迟到的写入，合并在新页面改过的最新文档上", () => {
    commitWorkbenchDoc("p", DOC);
    // 新页面加了场景
    const scenes = [{ id: "s1", name: "天台", mood: "" }];
    commitWorkbenchDoc("p", { ...getWorkbenchDoc("p")!, scenes });
    // 旧页面的重新生成角色回来了（patchData 以 getWorkbenchDoc 为底）
    const chars = [{ id: "n1", name: "新", role: "key" as const, cast: "", desc: "", avatar: "a1", bound: false }];
    commitWorkbenchDoc("p", { ...getWorkbenchDoc("p")!, characters: chars });
    expect(getWorkbenchDoc("p")?.scenes).toBe(scenes);
    expect(getWorkbenchDoc("p")?.characters).toBe(chars);
  });

  it("后台再读一次、期间本地没写过也没有在途保存：用服务端那份（别处的改动能看到）", async () => {
    commitWorkbenchDoc("p", DOC);
    const remote = { ...DOC, episodes: [{ no: 1, content: "别处改过" }] };
    const fetched = await serverRead(remote);
    adoptServerDoc("p", fetched, fetched.data);
    expect(getWorkbenchDoc("p")?.episodes[0].content).toBe("别处改过");
  });

  it("读取期间本地又写了一次：服务端那份比本地旧，不用", async () => {
    commitWorkbenchDoc("p", DOC);
    const gate = deferred<{ meta: object; data: ProjectData }>();
    const pending = fetchWorkbenchDoc("p", () => gate.promise);
    const mine = { ...DOC, episodes: [{ no: 1, content: "刚改的" }] };
    commitWorkbenchDoc("p", mine);
    gate.resolve({ meta: {}, data: DOC });
    const fetched = await pending;
    adoptServerDoc("p", fetched, fetched.data);
    expect(getWorkbenchDoc("p")).toBe(mine);
  });

  it("发起读取时还有保存在途：服务端那份可能还没收到这次保存，不用", async () => {
    commitWorkbenchDoc("p", DOC);
    const save = deferred<void>();
    const saving = trackWorkbenchSave("p", () => save.promise);
    const fetched = await serverRead({ ...DOC, episodes: [] });
    save.resolve();
    await saving;
    adoptServerDoc("p", fetched, fetched.data);
    expect(getWorkbenchDoc("p")?.episodes).toHaveLength(1);
  });

  it("挂着的页面跟着最新文档变（包括别的页面实例写进来的）", () => {
    const { result } = renderHook(() => useWorkbenchDoc("p"));
    expect(result.current).toBeNull();
    act(() => commitWorkbenchDoc("p", DOC));
    expect(result.current).toBe(DOC);
  });
});
