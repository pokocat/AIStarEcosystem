import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// §8.0.1 ⑥：写完没人挂的东西，编译器不会告诉你。钉住 v0.197 逐集制作（分镜 / 合成成片）的几处接线。
// 只断结构（谁把什么传给了谁、按什么字段判断），不断界面文案（§8.0.1 ⑩）。
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
const epscript = read("./stages/epscript.tsx");
const table = read("./storyboard-table.tsx");
const assemble = read("./stages/assemble.tsx");

describe("episode wiring", () => {
  it("「重新生成视频」一路接到了 render(clip)：epscript → StoryboardTable → ShotRow → ShotFrameCell", () => {
    expect(epscript).toMatch(/onRedoClip=\{\(sceneId, shotId\) => render\(sceneId, shotId, "clip"/);
    expect(table).toMatch(/onRedoClip=\{props\.onRedoClip \?/);
    expect(table).toMatch(/<ShotFrameCell[\s\S]*?onRedoClip=\{onRedoClip \?/);
    // ShotFrameCell 只在传了 onRedoClip 时才画按钮，并把本镜 id 交回去
    expect(table).toMatch(/const redoBtn = onRedoClip \?/);
    expect(table).toMatch(/onConfirm=\{\(\) => onRedoClip\(s\.id\)\}/);
  });

  it("后台对账走 planShotRecovery（规则与单测在 epscript-recovery），出新首帧时清旧视频 / 尾帧并挪 resetAt", () => {
    expect(epscript).toMatch(/const plan = planShotRecovery\(rows, snap\.tasks, state\.ep\)/);
    expect(epscript).not.toMatch(/current\?\.jobId === task\.id/);
    const m = epscript.match(/const applyFrameResult = React\.useCallback\(([\s\S]*?)\n  \);/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/videoUrl: undefined, lastFrameUrl: undefined, jobId: undefined/);
    expect(m![1]).toMatch(/endFrameUrl: undefined/);
    // 分界只往后挪（laterIso）：晚到的旧任务不能把重写时打的分界拉回去
    expect(m![1]).toMatch(/resetAt: laterIso\(cur\.resetAt, job\.created_at\)/);
    // 新镜头（重写本集 / 拆分镜 / 加一镜）都打分界：镜头 id 会和旧镜头重复
    expect(epscript.match(/resetAt: mark/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(epscript).toMatch(/resetAt: EPOCH_ISO/);
    expect(epscript).toMatch(/if \(!shot\.resetAt && lastTasksRef\.current\)/);
  });

  it("本页刚提交、列表里还看不到的镜头不被对账清掉「生成中」（防重复提交）；在途表是 render() 的唯一闸", () => {
    expect(epscript).toMatch(/inflightRef\.current\.set\(id, \{ jobId: null, kind, gen \}\)/);
    expect(epscript).toMatch(/if \(!inf \|\| !inf\.jobId\) continue;/);
    // 对账看到在跑的任务记进在途表（刷新后第一次对账之前点的生成，等完对账就被它挡住）
    expect(epscript).toMatch(/inflightRef\.current\.set\(shotId, \{ jobId: act\.taskId, kind: act\.kind, gen: genOf\(shotId\) \}\)/);
    expect(epscript).toMatch(/if \(!shot \|\| inflightRef\.current\.has\(id\) \|\| decomposingRef\.current === id\) return;/);
  });

  it("镜头被整体替换（重写本集 / 拆这一场 / 删一镜）时旧任务作废：换代 + 回填前比代", () => {
    expect(epscript.match(/retireShots\(\[/g)?.length ?? 0).toBe(3); // runEpDraft / genShots / delShot
    for (const fn of ["applyFrameResult", "applyClipResult"]) {
      const m = epscript.match(new RegExp(`const ${fn} = React\\.useCallback\\(([\\s\\S]*?)\\n  \\);`));
      expect(m).not.toBeNull();
      expect(m![1]).toMatch(/if \(genOf\(id\) !== gen\) return;/);
      expect(m![1]).toMatch(/if \(appliedRef\.current\.has\(job\.id\)\) return;/);
    }
  });

  it("按模型计价的生成在模型价格没读到时停用（不拿全局价报价）", () => {
    expect(epscript).toMatch(/const priceBlock = priceBlockReason\(renderModels\.status\)/);
    expect(epscript).toMatch(/priceBlock=\{priceBlock\}/);
    expect(table).toMatch(/const priced = priceBlock \? \{ disabled: true, title: priceBlock \} : \{\}/);
    expect(table.match(/\{\.\.\.priced\}/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("报价跟着所选模型：首帧 / 视频 / 重新生成 / 补尾帧 / AI 改图都从 renderCreditCost 来", () => {
    expect(epscript).toMatch(/const imageCost = renderCreditCost\(/);
    expect(epscript).toMatch(/const clipCostFor = \(shot[^)]*\) => renderCreditCost\(/);
    expect(epscript).toMatch(/frameCost=\{imageCost\}/);
    expect(epscript).toMatch(/clipCostFor=\{clipCostFor\}/);
    expect(epscript).toMatch(/endFrameCost=\{cfg\.prices\.decompose \+ imageCost\}/);
    expect(epscript).toMatch(/endFrameRetryCost=\{imageCost\}/);
    expect(epscript).not.toMatch(/frameCost=\{cfg\.prices\.frame\}/);
    // 每一镜按自己的时长报视频价
    expect(table).toMatch(/clipCost=\{props\.clipCostFor \? props\.clipCostFor\(s\) : props\.clipCost\}/);
    // AI 改图用分镜表上选的图片模型，价格才对得上；走短剧分镜模板，带上和正常出首帧同一句场景
    expect(table).toMatch(/<AiImageEditModal[\s\S]*?kind="shot"[\s\S]*?sceneName=\{sceneName\}[\s\S]*?cost=\{props\.frameCost \?\? FRAME_COST\}[\s\S]*?endpointId=\{props\.imageEndpointId\}/);
  });

  it("补尾帧按有没有尾帧图判断；动作描述有、尾帧图没有时是只重画尾帧（和 decompose 的 retryOnly 同一条件）", () => {
    expect(table).toMatch(/onDecompose && !s\.endFrameUrl && \(/);
    expect(table).toMatch(/const endFrameRetry = !!\(s\.motionDesc && s\.lfDesc\?\.trim\(\) && !s\.endFrameUrl\)/);
    expect(epscript).toMatch(/const retryOnly = !!\(shot\.motionDesc && shot\.lfDesc\?\.trim\(\) && !shot\.endFrameUrl\)/);
  });

  it("补过尾帧后改首帧：先确认，改成了把旧尾帧图去掉", () => {
    expect(table).toMatch(/onAiEdit=\{\(\) => void openAiEdit\(/);
    expect(table).toMatch(/if \(shot\.endFrameUrl\) \{\s*const ok = await dramaConfirm/);
    expect(epscript).toMatch(/onFrameEdited=\{\(sceneId, shotId, frameUrl\) => updShot\(sceneId, shotId, \{[^}]*endFrameUrl: undefined/);
  });

  it("本集还没有分镜：悬浮条和空态都指向「按剧情生成本集分镜」", () => {
    const cta = epscript.match(/<div className="ep-cta pop-in">([\s\S]*?)\n      \)\}/);
    expect(cta).not.toBeNull();
    expect(cta![1]).toMatch(/allShots\.length === 0 \?[\s\S]*?onClick=\{\(\) => void regenFromPlot\(\)\}/);
    expect(epscript).toMatch(/allShots\.length === 0 && \(\s*<div className="card ep-sb-none"/);
  });

  it("余额不再在工作台本地扣减，花完积分让 useWallet 重读", () => {
    expect(epscript).not.toMatch(/type: "spend"/);
    expect(assemble).not.toMatch(/type: "spend"/);
    expect(epscript).toMatch(/notifyWalletChanged\(\)/);
  });

  it("扣费按钮的动作把 Promise 交回 CreditButton（它等动作结束再刷新余额），中间不用 void 吞掉", () => {
    // epscript → StoryboardTable：拆镜 / 改写 / 出图出片 都直接返回动作的 Promise
    expect(epscript).toMatch(/onDecompose=\{\(sceneId, shotId\) => decompose\(sceneId, shotId\)\}/);
    expect(epscript).toMatch(/onRewriteShot=\{\(sceneId, shotId, instruction\) => rewriteShot\(/);
    expect(epscript).toMatch(/onGenShots=\{genShots\}/);
    expect(epscript).not.toMatch(/onRender=\{\(sceneId, shotId, kind\) => \{/);
    expect(epscript).not.toMatch(/=> void (decompose|rewriteShot|render|genShots)\(/);
    // ShotRow 的改写入口把 onRewrite 的返回值交回 onConfirm
    const rw = table.match(/const submitRw = \(text: string\)[^{]*\{([\s\S]*?)\n  \};/);
    expect(rw).not.toBeNull();
    expect(rw![1]).toMatch(/return pending;/);
  });

  it("生成结果回填不在 setState 的 updater 里落库（避免 setState-in-render 报错）", () => {
    const m = epscript.match(/const applyRenderPatch = React\.useCallback\(([\s\S]*?)\n  \);/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/persist\(/);
  });

  it("合成成片按「有没有视频」选镜头，和服务端 DramaAssembleService 同一口径", () => {
    expect(assemble).toMatch(/\.filter\(\(sh\) => !!sh\.videoUrl\)/);
    expect(assemble).not.toMatch(/flow === "done"/);
  });

  it("时间用 formatDateTime，不切 ISO 字符串", () => {
    expect(assemble).toMatch(/formatDateTime\(assembled\.at\)/);
    expect(assemble).not.toMatch(/\.slice\(0, ?1[06]\)/);
  });
});
