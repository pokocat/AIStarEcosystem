import { describe, expect, it, vi } from "vitest";

// 本地 mock 必须能走完主路径（docs/drama-ux-copy-pass.md §3.6，§8.0.1 ⑦）：
// 新建出来的短剧要真的出现在列表里、在工作台里打得开 —— 此前 mock createProject 只返回 meta，
// 脑暴「新建短剧」、多集模板「做同款」、「照这部新建一部」跳过去都是「没找到这部短剧」。
vi.mock("./_client", async () => ({
  USE_MOCK: true,
  ApiError: (await import("@ai-star-eco/api-client")).ApiError,
  mockDelay: <T,>(v: T) => Promise.resolve(v),
  apiFetch: vi.fn(() => Promise.reject(new Error("mock 模式不该走网络"))),
}));

import type { BoardShot } from "@/mocks/drama-workshop";
import {
  assembleEpisode,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  listTrashProjects,
  restoreProject,
  saveProject,
} from "./projects";
import { applyRecipe, listPublished } from "./recipes";
import { createBrainstorm, generateOutline, promote } from "./brainstorm";

describe("mock 短剧主路径", () => {
  it("createProject 之后列表里有、详情打得开，updatedAt 是 ISO", async () => {
    const d = await createProject({ title: "测试短剧", type: "悬疑短剧", typeKey: "mystery", mode: "guided", episodes: 12 });
    const list = await listProjects();
    expect(list.map((p) => p.id)).toContain(d.meta.id);
    const got = await getProject(d.meta.id);
    expect(got.meta.id).toBe(d.meta.id);
    expect(got.data.projectInfo.episodes).toBe(12);
    expect(Number.isNaN(Date.parse(got.meta.updatedAt ?? ""))).toBe(false);
  });

  it("saveProject 写回文档，再读是新内容", async () => {
    const d = await createProject({ type: "悬疑短剧", typeKey: "mystery", mode: "guided", episodes: 6 });
    await saveProject(d.meta.id, { ...d.data, projectInfo: { ...d.data.projectInfo, logline: "改过了" } }, { stage: 2 });
    const got = await getProject(d.meta.id);
    expect(got.data.projectInfo.logline).toBe("改过了");
    expect(got.meta.stage).toBe(2);
  });

  // 照服务端 DramaProjectService#saveProject + toSummary：卡片字段以 projectInfo 为准回写，
  // done 由进度推出。此前 mock 有旧记录时原样展开旧卡片，做完的短剧在列表里点开还是进工作台。
  it("saveProject 按文档回写卡片字段：标题 / 画幅 / 集数 / 互动模式，进度到 100 才算做完", async () => {
    const d = await createProject({ title: "旧标题", type: "悬疑短剧", typeKey: "mystery", mode: "guided", ratio: "9:16", episodes: 12 });
    const next = {
      ...d.data,
      projectInfo: { ...d.data.projectInfo, title: "新标题", ratio: "16:9", episodes: 6 },
      interactive: { enabled: true, startEpisodeId: "ep1", globalFlags: {}, nodes: {} },
    };
    const saved = await saveProject(d.meta.id, next, { stage: 6, progress: 100 });
    expect(saved.meta).toMatchObject({ title: "新标题", ratio: "16:9", episodes: 6, mode: "interactive", stage: 6, progress: 100, done: true });
    const listed = (await listProjects()).find((p) => p.id === d.meta.id);
    expect(listed?.done).toBe(true);
    expect((await getProject(d.meta.id)).meta.title).toBe("新标题");

    // 进度掉回 100 以下 → 不再带 done（服务端 toSummary 只在 ≥100 时发这个字段）。
    const back = await saveProject(d.meta.id, next, { progress: 80 });
    expect(back.meta.done).toBeUndefined();
    expect(back.meta.stage).toBe(6);
  });

  it("saveProject 空标题 / 非正集数不覆盖原值，stage / progress 夹在合法范围", async () => {
    const d = await createProject({ title: "留着", type: "悬疑短剧", typeKey: "mystery", mode: "guided", episodes: 8 });
    const saved = await saveProject(
      d.meta.id,
      { ...d.data, projectInfo: { ...d.data.projectInfo, title: "  ", episodes: 0 } },
      { stage: 9, progress: 140 },
    );
    expect(saved.meta).toMatchObject({ title: "留着", episodes: 8, mode: "guided", stage: 6, progress: 100 });
  });

  // 服务端 requireOwned：已经移进回收站 / 根本没有的短剧，读和存都是 404 DRAMA_PROJECT_NOT_FOUND。
  // 此前 mock 存一个不在列表里的 id 会凭空补一张卡片：删除之后才落地的自动保存，
  // 让同一部短剧同时出现在列表和回收站里。
  it("移进回收站之后才落地的保存 → 404，列表和回收站不会同时有它", async () => {
    const d = await createProject({ type: "悬疑短剧", typeKey: "mystery", mode: "guided", episodes: 6 });
    await deleteProject(d.meta.id);
    await expect(saveProject(d.meta.id, d.data, { progress: 10 })).rejects.toMatchObject({ code: "DRAMA_PROJECT_NOT_FOUND", status: 404 });
    await expect(getProject(d.meta.id)).rejects.toMatchObject({ code: "DRAMA_PROJECT_NOT_FOUND", status: 404 });
    expect((await listProjects()).map((p) => p.id)).not.toContain(d.meta.id);
    expect((await listTrashProjects()).map((p) => p.id)).toContain(d.meta.id);
    await expect(saveProject("dp_never_existed", d.data)).rejects.toMatchObject({ code: "DRAMA_PROJECT_NOT_FOUND" });
    expect((await listProjects()).map((p) => p.id)).not.toContain("dp_never_existed");
  });

  it("移到回收站 → 回收站里有、列表里没有；恢复后回到列表", async () => {
    const d = await createProject({ type: "悬疑短剧", typeKey: "mystery", mode: "guided", episodes: 6 });
    await deleteProject(d.meta.id);
    expect((await listProjects()).map((p) => p.id)).not.toContain(d.meta.id);
    expect((await listTrashProjects()).map((p) => p.id)).toContain(d.meta.id);
    await restoreProject(d.meta.id);
    expect((await listProjects()).map((p) => p.id)).toContain(d.meta.id);
    expect((await listTrashProjects()).map((p) => p.id)).not.toContain(d.meta.id);
  });

  it("多集模板做同款：建出来的短剧打得开，并带上模板的分集剧情", async () => {
    const series = (await listPublished()).find((r) => r.episodes > 1);
    expect(series).toBeTruthy();
    const out = await applyRecipe(series!);
    expect(out.kind).toBe("project");
    if (out.kind !== "project") return;
    const got = await getProject(out.projectId);
    expect(got.meta.mode).toBe("template");
    expect(got.data.episodes.length).toBe(series!.data.beats.length);
    // 服务端 seedProjectFromRecipe 不分横竖屏，一律每集 75 秒。
    expect(got.data.projectInfo.duration).toMatch(/^每集 75 秒$/);
  });

  it("聊天页新建短剧：建出来的短剧打得开；同一段对话再点一次回原去向、不重复建", async () => {
    const bs = await createBrainstorm("外卖小哥捡到一份手稿");
    const messages = [...bs.data.messages, { role: "user" as const, text: "走悬疑" }];
    const { outline } = await generateOutline(bs.meta.id, messages);
    const data = { ...bs.data, messages, outline };
    const first = await promote(bs.meta.id, "series", data);
    expect(first.kind).toBe("project");
    if (first.kind !== "project") return;
    await expect(getProject(first.projectId)).resolves.toBeTruthy();
    const again = await promote(bs.meta.id, "series", data);
    expect(again).toEqual(first);
  });

  // 与服务端 DramaProjectService#seedProjectData 同形：projectInfo.duration 是「每集 N 秒」（outline.tsx 改时长也写这个形状），
  // 横屏 60、其余 75；outlinePrefs.dur 是「N 秒/集」。
  it("createProject 的每集时长与服务端 seed 同形：横屏 60 秒、竖屏 75 秒", async () => {
    const wide = await createProject({ type: "悬疑短剧", typeKey: "mystery", mode: "guided", ratio: "16:9", episodes: 6 });
    expect(wide.data.projectInfo.duration).toMatch(/^每集 60 秒$/);
    expect(wide.data.outlinePrefs?.dur).toMatch(/^60 秒\/集$/);
    const tall = await createProject({ type: "悬疑短剧", typeKey: "mystery", mode: "guided", ratio: "9:16", episodes: 6 });
    expect(tall.data.projectInfo.duration).toMatch(/^每集 75 秒$/);
    expect(tall.data.outlinePrefs?.dur).toMatch(/^75 秒\/集$/);
    expect(tall.data.episodeDocs).toEqual({});
    const inter = await createProject({ type: "互动剧", typeKey: "custom", mode: "interactive", episodes: 3 });
    expect(inter.data.interactive?.enabled).toBe(true);
  });
});

describe("mock 合成成片（与服务端 DramaAssembleService 同口径）", () => {
  const shot = (no: number, dur: number, videoUrl?: string): BoardShot => ({
    id: `sh${no}`,
    no,
    size: "中景",
    move: "固定",
    dur,
    engine: "seedance",
    desc: "",
    cast: [],
    line: null,
    ...(videoUrl ? { videoUrl } : {}),
  });

  it("镜数 = 这一集有视频的镜头数，时长 = 这几镜时长之和", async () => {
    const d = await createProject({ type: "悬疑短剧", typeKey: "mystery", mode: "guided", episodes: 6 });
    await saveProject(d.meta.id, {
      ...d.data,
      episodeDocs: {
        "2": {
          script: { ep: 2, scenes: [] },
          storyboard: {
            ep: 2,
            scenes: [
              { id: "s1", shots: [shot(2, 5, "/cdn/b.mp4"), shot(1, 4, "/cdn/a.mp4"), shot(3, 6)] },
              { id: "s2", shots: [shot(1, 3, "/cdn/c.mp4")] },
            ],
          },
        },
      },
    });
    const out = await assembleEpisode(d.meta.id, 2);
    expect(out.shotCount).toBe(3);
    expect(out.durationSec).toBe(12);
    expect(out.url).toBeTruthy();
    expect(Number.isNaN(Date.parse(out.at ?? ""))).toBe(false);
  });

  it("这一集没有可拼的镜头 → DRAMA_ASSEMBLE_NO_CLIPS；项目不存在 → DRAMA_PROJECT_NOT_FOUND", async () => {
    const d = await createProject({ type: "悬疑短剧", typeKey: "mystery", mode: "guided", episodes: 6 });
    await expect(assembleEpisode(d.meta.id, 1)).rejects.toMatchObject({ code: "DRAMA_ASSEMBLE_NO_CLIPS" });
    await expect(assembleEpisode("dp_nope", 1)).rejects.toMatchObject({ code: "DRAMA_PROJECT_NOT_FOUND" });
  });
});
