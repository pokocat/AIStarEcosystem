import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// §8.0.1 ⑥ / ⑩：钉住首页两处「开始制作短视频」的扣费确认接线，只断结构，不断界面文案。
// 这一笔 shortEntry 全站只许走共享的 confirmShortStart（components/drama-workshop/short-start-confirm）：
// 首页模板预览里单条模板的「做同款」、聊天页选「单条短视频」后的主按钮。
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
const dashboard = read("../../../app/(workspace)/dashboard/page.tsx");
const studio = read("./brainstorm-studio.tsx");
const preview = read("../preview-modal.tsx");
const SHARED = /from "@\/components\/drama-workshop\/short-start-confirm"/;

describe("首页 · 开始制作短视频的扣费确认", () => {
  it("首页单条模板做同款：确认交给 confirmShortStart(fromTemplate)，不再自己拼确认文案", () => {
    expect(dashboard).toMatch(SHARED);
    expect(dashboard).toMatch(/confirm: \(\) => confirmShortStart\(cfg, SHORT_START_LEAD\.fromTemplate\)/);
    expect(dashboard).not.toMatch(/confirmTitle|confirmBody|confirmLabel/);
  });

  it("聊天页选单条短视频：确认交给 confirmShortStart(fromOutline)", () => {
    expect(studio).toMatch(SHARED);
    expect(studio).toMatch(/confirmShortStart\(cfg, SHORT_START_LEAD\.fromOutline\)/);
  });

  it("首页那份旧的 short-start-confirm 已删，没人再引用", () => {
    expect(existsSync(resolve(__dirname, "./short-start-confirm.ts"))).toBe(false);
    for (const src of [dashboard, studio]) expect(src).not.toMatch(/home\/short-start-confirm|"\.\/short-start-confirm"/);
  });

  it("预览弹窗自己不再弹通用扣费确认（CreditButton），扣费动作必须由调用方给 confirm", () => {
    expect(preview).not.toMatch(/<CreditButton|import \{[^}]*CreditButton/);
    expect(preview).toMatch(/ok = await action\.confirm\(\)/);
  });
});
