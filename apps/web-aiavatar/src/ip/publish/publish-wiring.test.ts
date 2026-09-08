// 发布链路「接没接上」的结构测试。
//
// 为什么需要这么一条看起来很笨的测试：v0.157 把画布整个换成搬来的无限画布时，
// 旧画布页连同它挂着的「发布」按钮一起退役了，而 PublishDialog 和 publishProject
// **两个文件都还在、都还能编译、typecheck 全绿** —— 只是再没有任何地方引用它们。
// 于是「造形象 → 登记资产 → 对外发布」这条链在生产上断了一版，谁也没发现：
// 死代码不会报错，它只是安静地不存在。
//
// 所以这里守的不是某个函数的行为，而是**这几个模块之间还连着**。
// 编译器查不出「组件没人挂」，那就让测试查。

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const host = read("src/ip/canvas-host.tsx");

describe("发布链路必须挂在画布上", () => {
  it("画布宿主挂了发布弹窗", () => {
    expect(host).toContain("PublishDialog");
    expect(host).toMatch(/<PublishDialog\b/);
  });

  it("发布按钮真的调服务端，而不是只开个弹窗", () => {
    expect(host).toContain("publishProject");
  });

  it("已发布的项目不再给一个必然 409 的按钮", () => {
    // 服务端对重复发布返回 IP_PROJECT_ALREADY_PUBLISHED；
    // 按钮得在点之前就说清楚状态，而不是让人点了才知道。
    expect(host).toContain("publishedAvatarId");
  });
});

describe("发布弹窗的外壳", () => {
  const dialog = read("src/ip/publish/publish-dialog.tsx");

  it("用 antd 的 Modal —— 它是从画布里调起的，得跟画布同一套层级管理", () => {
    // 画布（搬来的 infinite-canvas）整套用 antd：Modal z-1000、气泡 z-1200。
    // shadcn 的 Dialog 是 z-50，同屏时会被压在下面。
    expect(dialog).toMatch(/from "antd"/);
    expect(dialog).not.toMatch(/from "@ai-star-eco\/ui\/ui\/dialog"/);
  });

  it("发布在途时不能被遮罩/Esc 关掉", () => {
    // 关了也停不下已经发出去的请求，用户只会以为没发成功而重来一次。
    expect(dialog).toContain("mask={{ closable: !submitting }}");
    expect(dialog).toContain("keyboard={!submitting}");
  });

  it("没用 antd 6 已废弃的 maskClosable", () => {
    expect(dialog).not.toMatch(/\bmaskClosable=/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 发布之前必须先把画布存上（v0.179）。
//
// 结构 + 行为一起守：结构测「宿主真的走了这道闸」，行为测「闸门本身的判断」。
// 光测字符串会漏掉「接上了但判断写反」，光测函数会漏掉「函数写好了没人用」——
// v0.159 的死代码事故就是后者。
import { publishWithLatestDoc } from "@/canvas-bridge/publish-gate";

describe("发布前先保存", () => {
  it("宿主把发布挂在这道闸上，而不是直接调服务端", () => {
    expect(host).toContain("publishWithLatestDoc");
    // 顺序也要对：闸在前、publishProject 在闸的回调里
    expect(host.indexOf("publishWithLatestDoc")).toBeLessThan(host.indexOf("publishProject"));
  });

  it("存好了才发布，且发布发生在保存**之后**", async () => {
    const order: string[] = [];
    const saveNow = vi.fn(async () => { order.push("save"); return "saved" as const; });
    const publish = vi.fn(async () => { order.push("publish"); return { avatarId: "DH-1", lookIds: [] }; });
    await expect(publishWithLatestDoc(saveNow, publish)).resolves.toMatchObject({ avatarId: "DH-1" });
    expect(order).toEqual(["save", "publish"]);
  });

  it("没存上就不发布 —— 否则发出去的是服务端上的旧内容", async () => {
    const publish = vi.fn();
    await expect(publishWithLatestDoc(async () => "failed", publish)).rejects.toThrow(/重试保存/);
    expect(publish).not.toHaveBeenCalled();
  });

  it("撞上别处的编辑同样不发布，并指出要刷新", async () => {
    const publish = vi.fn();
    await expect(publishWithLatestDoc(async () => "conflict", publish)).rejects.toThrow(/刷新/);
    expect(publish).not.toHaveBeenCalled();
  });

  it("本来就没有未保存的改动时照常发布（不要把「没什么可存」当成失败）", async () => {
    const publish = vi.fn(async () => ({ avatarId: "DH-2", lookIds: [] }));
    await expect(publishWithLatestDoc(async () => "nothing-to-save", publish)).resolves.toMatchObject({ avatarId: "DH-2" });
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
