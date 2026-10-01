// 「AI 创作 → 视频生成」接没接上的结构测试（AGENTS.md §8.0.1 ⑥）。
//
// 编译器查不出「组件写好了但没人挂」：v0.159 的发布按钮、v0.160 的 fetchModels() 都是
// 文件在、typecheck 全绿、就是没有任何地方引用，功能在生产上缺了一整版。
// 这里守的是几处之间还连着：侧栏入口 → 路由页面 → 页面组件 → 接口层，以及用户能点的
// 按钮真的调到了接口（而不是只改了个本地状态）。二版加的智能优化、存为模板、做同款、模板页签同样守着。

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

const srcPath = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p: string) => readFileSync(srcPath(p), "utf8");

describe("侧栏与面包屑", () => {
  const layout = read("app/(workspace)/layout.tsx");

  test("「AI 创作」分组紧跟在「工作台」分组后面", () => {
    const work = layout.indexOf('title: "工作台"');
    const studio = layout.indexOf('title: "AI 创作"');
    const make = layout.indexOf('title: "制作"');
    assert.ok(work >= 0, "找不到「工作台」分组");
    assert.ok(studio > work, "「AI 创作」要在「工作台」之后");
    assert.ok(make > studio, "「AI 创作」要在「制作」之前");
  });

  test("「视频生成」入口指向 /studio/video，并在该页高亮", () => {
    assert.match(
      layout,
      /\{\s*icon: Clapperboard,\s*label: "视频生成",\s*href: "\/studio\/video",\s*selected: pathname === "\/studio\/video"\s*\}/,
    );
    assert.match(layout, /import \{[^}]*\bClapperboard\b[^}]*\} from "lucide-react"/);
  });

  test("面包屑：AI 创作 / 视频生成", () => {
    assert.match(layout, /if \(pathname === "\/studio\/video"\) return \["AI 创作", "视频生成"\];/);
  });
});

describe("页面与接口层", () => {
  test("路由页面存在，并渲染视频生成组件", () => {
    const page = "app/(workspace)/studio/video/page.tsx";
    assert.ok(existsSync(srcPath(page)), `${page} 不存在`);
    const src = read(page);
    assert.match(src, /import \{ VideoStudio \} from "@\/components\/video-studio"/);
    assert.match(src, /<VideoStudio\s*\/>/);
    assert.match(read("components/video-studio/index.ts"), /export \{ VideoStudio \} from "\.\/VideoStudio"/);
  });

  test("api/index.ts 导出 VideoStudioApi", () => {
    const index = read("api/index.ts");
    assert.match(index, /import \* as VideoStudioApi from "\.\/video-studio";/);
    assert.match(index, /export \{[^}]*\bVideoStudioApi\b[^}]*\};/);
  });

  test("接口路径照 plan §4 写成字面量（契约门 scripts/check-api-contract.mjs 要能看见）", () => {
    const api = read("api/video-studio.ts");
    for (const literal of [
      'apiFetch<VideoStudioModel[]>("/me/celebrity/video-studio/models")',
      'apiFetch<VideoStudioUpload>("/me/celebrity/video-studio/uploads", { method: "POST", body: form })',
      'apiFetch<VideoStudioJob>("/me/celebrity/video-studio/jobs", { method: "POST", body: req })',
      'apiFetch<VideoStudioJob[]>("/me/celebrity/video-studio/jobs")',
      "apiFetch<VideoStudioJob>(`/me/celebrity/video-studio/jobs/${encodeURIComponent(id)}`)",
      'apiFetch<VideoStudioOptimization>("/me/celebrity/video-studio/prompt-optimizations", {\n    method: "POST",\n    body: req,\n  })',
      "apiFetch<VideoStudioOptimization>(`/me/celebrity/video-studio/prompt-optimizations/${encodeURIComponent(id)}`)",
      'apiFetch<VideoStudioTemplate[]>("/me/celebrity/video-studio/templates")',
      "apiFetch<VideoStudioTemplate>(`/me/celebrity/video-studio/templates/${encodeURIComponent(id)}`)",
      'apiFetch<VideoStudioTemplate>("/me/celebrity/video-studio/templates", { method: "POST", body: req })',
      'apiFetch<void>(`/me/celebrity/video-studio/templates/${encodeURIComponent(id)}`, { method: "DELETE" })',
    ]) {
      assert.ok(api.includes(literal), literal);
    }
    assert.match(api, /form\.append\("file", file\);/);
    assert.match(api, /form\.append\("mediaType", mediaType\);/);
  });
});

describe("用户能点的东西真的接到了接口", () => {
  const studio = read("components/video-studio/VideoStudio.tsx");
  const form = read("components/video-studio/VideoStudioForm.tsx");
  const list = read("components/video-studio/JobList.tsx");
  const card = read("components/video-studio/JobCard.tsx");
  const jobsHook = read("components/video-studio/use-video-studio-jobs.ts");
  const modelsHook = read("components/video-studio/use-video-studio-models.ts");

  test("页面同时挂了表单和生成记录，提交成功的任务会进列表", () => {
    assert.match(studio, /<VideoStudioForm\b[^>]*onSubmitted=\{handleSubmitted\}/);
    assert.match(studio, /prependJob\(job\);/);
    assert.match(studio, /const \{ prepend: prependJob \} = jobs;/);
    assert.match(studio, /<JobList\b[^>]*state=\{jobs\}/);
    assert.match(studio, /useVideoStudioModels\(\)/);
    assert.match(studio, /useVideoStudioJobs\(\)/);
  });

  test("底部主按钮：没勾智能优化就提交生成，请求体交给 buildJobRequest 组", () => {
    assert.match(form, /onClick=\{handlePrimary\}/);
    assert.match(form, /else void submitGeneration\(prompt, null, "footer"\);/);
    assert.ok(form.includes("VideoStudioApi.submitJob(request)"));
    assert.ok(form.includes("buildJobRequest(model, draftWith("));
    assert.ok(form.indexOf("buildJobRequest(model, draftWith(") < form.indexOf("VideoStudioApi.submitJob(request)"));
    assert.ok(form.includes("onSubmitted(job)"));
  });

  test("首帧 / 尾帧 / 参考素材都走上传接口", () => {
    assert.ok(form.includes('VideoStudioApi.upload(file, "image")'));
    assert.ok(form.includes("VideoStudioApi.upload(accepted[i], mediaType)"));
    assert.match(form, /onPick=\{\(f\) => void pickFrame\("first", f\)\}/);
    assert.match(form, /onPick=\{\(f\) => void pickFrame\("last", f\)\}/);
    assert.match(form, /onAdd=\{addReferences\}/);
    assert.match(form, /onMove=\{moveReference\}/);
    assert.match(form, /onRemove=\{removeReference\}/);
  });

  test("报价与预检用的是同一份纯逻辑（lib/video-studio.ts），模型没加载成功不报价，没定价不许提交", () => {
    assert.match(form, /const price = modelsError \? null : quote\(/);
    assert.ok(form.includes("preflight(contract, {"));
    assert.match(form, /: !price\s*\? "这个规格还没定价，暂时不能提交"/);
    assert.match(form, /optimizationPrice\(model\.pricing\)/);
  });

  test("生成记录：进页面就拉、按 5 秒轮询、页面不在前台就停", () => {
    assert.ok(jobsHook.includes("VideoStudioApi.listJobs()"));
    assert.ok(jobsHook.includes("VideoStudioApi.getJob(id)"));
    assert.match(jobsHook, /export const VIDEO_STUDIO_POLL_MS = 5_000;/);
    assert.ok(jobsHook.includes('document.visibilityState === "visible"'));
    assert.match(jobsHook, /const polling = activeCount > 0 && visible;/);
    assert.ok(modelsHook.includes("VideoStudioApi.listModels()"));
  });

  test("「刷新」按钮与签名地址过期后的换新都接上了", () => {
    assert.match(list, /onClick=\{reload\}/);
    assert.match(
      list,
      /<JobCard key=\{job\.id\} job=\{job\} onMediaExpired=\{refreshJob\} onSaveTemplate=\{onSaveTemplate\} \/>/,
    );
    // 播放器加载失败 → 先把手上的地址标成失效，再找服务端换一份（地址平时不跟着轮询换，免得打断播放）
    assert.match(card, /onError=\{\(\) => \{\s*markBroken\(\);\s*onExpired\(\);\s*\}\}/);
    assert.doesNotMatch(card, /key=\{videoUrl\}/, "按地址做 key 会让每次轮询都重建播放器");
  });
});

describe("智能优化接上了（plan §9）", () => {
  const form = read("components/video-studio/VideoStudioForm.tsx");
  const panel = read("components/video-studio/OptimizePanel.tsx");
  const hook = read("components/video-studio/use-prompt-optimization.ts");
  const ui = read("constants/video-studio-ui.ts");

  test("提示词下面有「智能优化」勾选框，默认勾上、记在本机（读写都包 try/catch）", () => {
    assert.match(form, /checked=\{optimizeOn\}\s*onChange=\{\(e\) => toggleOptimize\(e\.target\.checked\)\}/);
    assert.ok(form.includes("智能优化\n          </label>"), "勾选框的字是「智能优化」");
    assert.match(form, /useState<boolean>\(readOptimizePref\)/);
    assert.match(form, /return v === null \? true : v === "1";/);
    assert.match(form, /try \{\s*const v = window\.localStorage\.getItem\(VIDEO_STUDIO_OPTIMIZE_PREF_KEY\);/);
    assert.match(form, /try \{\s*window\.localStorage\.setItem\(VIDEO_STUDIO_OPTIMIZE_PREF_KEY, on \? "1" : "0"\);/);
  });

  test("勾上时按钮是「优化并继续」，点了走发起优化接口", () => {
    assert.match(form, /optimizeOn \? "优化并继续" : "生成"/);
    assert.match(form, /if \(optimizeOn\) startOptimization\(null\);/);
    assert.match(form, /buildOptimizationRequest\(model, draftWith\(prompt, null\), reuseRequestId \?\? newClientRequestId\(\)\)/);
    assert.match(form, /optimization\.start\(request\);/);
    assert.ok(hook.includes("VideoStudioApi.createOptimization(request)"));
  });

  test("结果每 2 秒查一次，页面不在前台就停、回来马上补查", () => {
    assert.match(ui, /export const VIDEO_STUDIO_OPTIMIZE_POLL_MS = 2_000;/);
    assert.ok(hook.includes("VideoStudioApi.getOptimization(id)"));
    assert.match(hook, /if \(!runningId \|\| !visible\) return;/);
    assert.match(hook, /if \(v && runningRef\.current\) void pollRef\.current\(runningRef\.current\);/);
  });

  test("结果那一块挂在表单里，三个按钮各自接上：用这版（带 optimizationId）/ 原提示词 / 先不生成", () => {
    assert.match(form, /<OptimizePanel\b/);
    assert.match(form, /void submitGeneration\(optView\.draft, optView\.optimization\.id, "panel"\)/);
    assert.match(form, /onUseOriginal=\{\(\) => void submitGeneration\(prompt, null, "panel"\)\}/);
    assert.match(form, /onDismiss=\{optimization\.dismiss\}/);
    assert.match(form, /onRetry=\{retryOptimization\}/);
    assert.match(panel, /onClick=\{onUseOptimized\}[\s\S]{0,400}用这版生成/);
    assert.match(panel, /onClick=\{onUseOriginal\}[\s\S]{0,200}改用原提示词生成/);
    assert.match(panel, /onClick=\{onDismiss\}[\s\S]{0,120}先不生成/);
    assert.match(panel, /onClick=\{onUseOriginal\}[\s\S]{0,400}直接用原提示词生成/);
    assert.match(panel, /onClick=\{onRetry\}[\s\S]{0,200}重新优化/);
  });

  test("「重新优化」用新的 clientRequestId（只有上一次结果不明时才沿用旧的）", () => {
    assert.match(form, /startOptimization\(optView\.phase === "failed" \? optView\.reuseRequestId : null\)/);
    assert.match(hook, /reuseRequestId: definitive \? null : request\.clientRequestId/);
  });
});

describe("存为模板 / 模板页签 / 做同款接上了（plan §10）", () => {
  const studio = read("components/video-studio/VideoStudio.tsx");
  const form = read("components/video-studio/VideoStudioForm.tsx");
  const list = read("components/video-studio/JobList.tsx");
  const card = read("components/video-studio/JobCard.tsx");
  const dialog = read("components/video-studio/SaveTemplateDialog.tsx");
  const tplList = read("components/video-studio/TemplateList.tsx");
  const tplCard = read("components/video-studio/TemplateCard.tsx");
  const tplHook = read("components/video-studio/use-video-studio-templates.ts");

  test("成功的生成记录上有「存为模板」，一路接到弹窗和保存接口", () => {
    assert.match(card, /onClick=\{\(\) => onSaveTemplate\(job\)\}[\s\S]{0,400}存为模板/);
    assert.match(list, /onSaveTemplate=\{onSaveTemplate\}/);
    assert.match(studio, /<JobList state=\{jobs\} onSaveTemplate=\{setSavingJob\} \/>/);
    assert.match(studio, /<SaveTemplateDialog\s+job=\{savingJob\}/);
    assert.match(dialog, /VideoStudioApi\.createTemplate\(\{\s*jobId: job\.id,/);
    assert.match(dialog, /official: canPublishOfficial && official,/);
  });

  test("只有运营看得到「发布为官方模板」，运营身份用 canUseOperatorTools 判", () => {
    assert.match(studio, /const isOperator = canUseOperatorTools\(user\?\.operatorRole\);/);
    assert.match(studio, /canPublishOfficial=\{isOperator\}/);
    assert.match(dialog, /\{canPublishOfficial \? \(\s*<label[\s\S]{0,400}发布为官方模板（所有用户都能看到）/);
  });

  test("右栏有「生成记录」「模板」两个页签，模板页签渲染模板列表、数据来自模板接口", () => {
    assert.match(studio, /onClick=\{\(\) => setTab\("jobs"\)\}>\s*生成记录/);
    assert.match(studio, /onClick=\{\(\) => setTab\("templates"\)\}>\s*模板/);
    assert.match(studio, /<TemplateList state=\{templates\}/);
    assert.match(studio, /useVideoStudioTemplates\(\)/);
    assert.ok(tplHook.includes("VideoStudioApi.listTemplates()"));
    assert.match(tplList, /aria-label="官方模板"/);
    assert.match(tplList, /aria-label="我的模板"/);
  });

  test("「做同款」：卡片按钮 → 页面 → 表单填表，提交时带上 templateId", () => {
    assert.match(tplCard, /onClick=\{\(\) => onUse\(template\)\}[\s\S]{0,300}做同款/);
    assert.match(tplList, /onUse=\{onUse\}/);
    assert.match(studio, /onUse=\{startFromTemplate\}/);
    assert.match(studio, /setPendingTemplate\(\(prev\) => \(\{ template, nonce: \(prev\?\.nonce \?\? 0\) \+ 1 \}\)\)/);
    assert.match(studio, /pendingTemplate=\{pendingTemplate\}/);
    assert.match(form, /applyTemplate\(pendingTemplate\.template\);/);
    assert.match(form, /const plan = planTemplateApply\(template, models\);/);
    assert.match(form, /templateId: templateState\?\.id \?\? null,/);
    assert.match(form, /onClick=\{exitTemplate\}[\s\S]{0,300}不做同款了/);
    assert.match(form, /正在做同款：\{templateState\.title\}/);
  });

  test("做同款提交成功后，模板的「已做同款」次数就地 +1", () => {
    assert.match(studio, /if \(job\.templateId\) bumpUseCount\(job\.templateId\);/);
  });

  test("删除 / 撤回先用统一的确认弹窗（useConfirm）确认，再调删除接口，不用浏览器原生确认框", () => {
    assert.match(tplList, /const \{ confirm: askConfirm, ConfirmHost \} = useConfirm\(\);/);
    assert.match(tplList, /const ok = await askConfirm\(\{/);
    assert.ok(tplList.indexOf("await askConfirm({") < tplList.indexOf("VideoStudioApi.deleteTemplate(template.id)"));
    assert.match(tplList, /<ConfirmHost \/>/);
    assert.match(tplCard, /onClick=\{\(\) => onRemove\(template\)\}/);
    // 与全仓门禁同一条正则（AGENTS.md §8：不许浏览器原生 confirm / alert / prompt）
    for (const src of [tplList, tplCard, form, studio, dialog]) {
      assert.doesNotMatch(src, /window\.(confirm|alert|prompt)|[^.]\b(confirm|alert)\(/);
    }
  });
});
