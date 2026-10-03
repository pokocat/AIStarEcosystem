import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// §8.0.1 ⑥：规则写在 shot-run.ts 里、有单测，但页面要是没用上，编译器不会告诉你。
// 这里钉住制作页和分镜表的几处接线：只断结构（谁调了谁、传了什么），不断界面文案（§8.0.1 ⑩）。
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
const page = read("./page.tsx");
const table = read("../../../../components/drama-workshop/short-storyboard-table.tsx");

describe("shorts/make wiring", () => {
  it("批量生成的目标来自 batchTargets，提交前再按最新状态判一次，循环走 runBatch", () => {
    expect(page).toMatch(/const targets = batchTargets\(shotsRef\.current/);
    expect(page).toMatch(/await runBatch\(\{/);
    expect(page).toMatch(/stillNeeded: \(id\) => \{[\s\S]*?!hasCurrentVideo\(cur\) && !isInFlight\(cur/);
    // 旧写法：只按 !videoUrl 选镜，会把在途镜头再交一次
    expect(page).not.toMatch(/shots\.filter\(\(s\) => !s\.videoUrl\)/);
  });

  it("单镜入口：这一镜有 pendingJob 时不提交，改去等那条任务", () => {
    expect(page).toMatch(/if \(shot\.pendingJob\) \{\s*void watchPending\(id, shot\.pendingJob\);\s*return "pending";/);
    // 分镜表把在途镜头当成「生成中」画（不给生成按钮）
    expect(page).toMatch(/pending=\{pendingView\}/);
    expect(table).toMatch(/busy=\{busy && busy\.id === s\.id \? busy\.to : pending\?\.\[s\.id\]\?\.kind \?\? null\}/);
  });

  it("离开页面停掉这一轮：返回按钮 stop，卸载 dispose，新任务号立刻落库", () => {
    expect(page).toMatch(/const leaveToStudio = async \(\) => \{[\s\S]*?runGateRef\.current\.stop\(\);/);
    expect(page).toMatch(/return \(\) => \{\s*aliveRef\.current = false;\s*runGateRef\.current\.dispose\(\);/);
    expect(page).toMatch(/if \(added\) void flushSave\(\)/);
  });

  it("首帧结果统一走 freshFramePatch（正常轮询 / 后台等 / 进页对账都经 settleJob）；AI 改图走 frameEditPatch", () => {
    expect(page).toMatch(/updShot\(id, freshFramePatch\(frames\.map/);
    // AI 改图按回来那一刻的最新状态判：在途 / 已有视频时不清任务号（frameEditPatch 有单测）
    expect(page).toMatch(/onFrameEdited=\{applyFrameEdit\}/);
    expect(page).toMatch(/const \{ late, patch \} = frameEditPatch\(cur, frameUrl, busyRef\.current\?\.id\)/);
    expect(page).not.toMatch(/onFrameEdited=\{\(id, frameUrl\) => updShot\(id, freshFramePatch/);
    // 首帧回填不再有只改 flow / frameUrl、留着旧视频的写法
    expect(page).not.toMatch(/updShot\([^)]*\{ flow: "frame", frameUrls:/);
    expect(page).toMatch(/const approvableIds = pickApprovableIds\(shots, busyId\)/);
  });

  it("聊天页带来的故事（草稿自带 idea）自动写脚本，不当成「风格」；做同款补的主题 / 本页新建的不算", () => {
    expect(page).toMatch(/setIdeaOrigin\("typed"\)/);
    expect(page).toMatch(/setIdeaOrigin\("created"\)/);
    expect(page).toMatch(/const storyFromDraft = ideaOrigin === "draft" && !!initial\.idea && !hasTemplate && !initial\.reopen;/);
    expect(page).toMatch(/const hasStyle = !hasTemplate && !!styleRef && !storyFromDraft;/);
    // 带 idea 且还没有分镜 → 进页自动跑一次写脚本
    expect(page).toMatch(/if \(!autoGenRef\.current && realIdea && shots\.length === 0\)/);
  });

  it("报价按所选模型逐镜算，不再用镜数 × 默认单价", () => {
    expect(page).toMatch(/const cost = sumCost\(targets, clipCostOf\)/);
    expect(page).not.toMatch(/\* cfg\.prices\.clip/);
    expect(page).toMatch(/clipCostFor=\{clipCostOf\}/);
    expect(table).toMatch(/clipCost=\{clipCostFor\(s\)\}/);
    // AI 改图带上价格（弹窗每次改图都确认）
    expect(table).toMatch(/cost=\{aiEditCost\}/);
  });

  it("结果没落到镜上（stale）不返回 done；批量只把真拿到视频的镜标成就用这版", () => {
    expect(page).toMatch(/if \(r === "stale"\) return "stale";/);
    expect(page).toMatch(/onShotDone: \(s, done\) => \{[\s\S]*?pickApprovableIds\(\[cur\]/);
  });

  it("任务查不到 / 轮询出错：对账走 job-peek（认得 non_null 的空结果），render 出错时交给后台等而不是报失败", () => {
    expect(page).toMatch(/import \{ isPollTimeout, peekJob \} from "\.\/job-peek"/);
    expect(page).not.toMatch(/async function peekJob/);
    expect(page).toMatch(/if \(pj && holding\) \{\s*if \(aliveRef\.current\) void watchPending\(id, pj\);\s*return "pending";/);
    // watchPending 的异常分支：查完先看页面还在不在
    expect(page).toMatch(/const peek = await peekJob\(pj\);\s*\/\/[^\n]*\n\s*if \(!aliveRef\.current\) return;/);
  });

  it("草稿读写都经 draftSync 排队；离页后迟到的任务号只补那一镜，不整份保存旧快照", () => {
    expect(page).not.toMatch(/void ShortsApi\.saveDraft\(/);
    expect(page).toMatch(/draftSync\.enqueue\(draftIdParam, \(\) => ShortsApi\.getDraft\(draftIdParam\)\)/);
    expect(page).toMatch(/void draftSync\.reportLateJob\(draftId, shotId, pj\)/);
    expect(page).toMatch(/draftSync\.subscribe\(draftId,/);
  });

  it("模型和价格没读到时停用按模型计价的入口；一起生成这一轮锁住模型和秒数", () => {
    expect(page).toMatch(/const priceBlock = priceBlockReason\(renderModels\.status\)/);
    expect(page).toMatch(/const runAll = async \(\) => \{[\s\S]*?if \(priceBlock\) \{/);
    expect(page).toMatch(/priceBlock=\{priceBlock\}/);
    expect(page).toMatch(/onClick=\{renderModels\.retry\}/);
    expect(page).toMatch(/<RenderModelSelect lane="video" models=\{renderModels\.models\} disabled=\{!!runProgress\}/);
    expect(table).toMatch(/<ShotFrameCell[\s\S]*?priceBlock=\{priceBlock\}/);
    expect(table).toMatch(/const block = priceBlock \|\| runLock;/);
    expect(table).toMatch(/disabled=\{locked \|\| durLocked\}/);
    // 改图弹窗：短视频模板 + 与首帧同一个图片模型
    expect(table).toMatch(/<AiImageEditModal\s+kind="short"\s+endpointId=\{props\.imageEndpointId\}/);
  });
});
