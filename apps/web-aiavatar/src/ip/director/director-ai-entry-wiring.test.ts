// 2026-10-29 用户反馈：导演台内容区到处是文字不同的 AI 入口（「和助手讨论本集分镜」「AI 改镜头」「和助手讨论」…）。
// 现在统一为 AskAI / AiField 的紫色小圆钮：只有图标，名称写在悬停提示和读屏名称里。这里钉住旧的长文字入口不再回来。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const read = (f: string) => readFileSync(join(__dirname, f), "utf8");
const files = ["director-script.tsx", "director-script-reference.tsx", "director-storyboard.tsx", "director-assets.tsx", "director-workbench.tsx"];

test("content-area AI entries are AskAI / AiField icons, not text buttons", () => {
  for (const f of files) {
    const src = read(f);
    for (const old of ["和助手讨论这一集", "和助手讨论本集分镜", "AI 改镜头", "AI 完善", "围绕这张图修改", "让 AI 改分镜图提示词", 'label="和助手讨论"'])
      expect(src, `${f} 里还有「${old}」`).not.toContain(old);
    // 入口一律走 AskAI / AiField，不再手写 director-ask-ai 按钮。
    expect(src, `${f} 手写了 director-ask-ai`).not.toContain('className="director-ask-ai');
    expect(src).not.toMatch(/<AskAI[^>]*\blabel=/);
  }
});

test("prompt, script and asset fields carry the corner entry", () => {
  expect(read("director-storyboard.tsx")).toMatch(/<AiField scope=\{\{ kind: "prompt", clipId: clip\.id, which \}\}/);
  // 正文入口点下去时才取光标位置（长正文时助手读光标附近那一段）。
  expect(read("director-script.tsx")).toMatch(/<AiField scope=\{\(\) => \(\{ kind: "script", episodeId: target, focusAt: offset\.current \+ \(area\.current\?\.selectionStart \?\? 0\) \}\)\}/);
  expect(read("director-assets.tsx")).toContain("<AiField scope={current && !audioOnly");
  // 一键制作、重写、生成这些实际操作不是 AI 入口，不能变成同一种图标。
  expect(read("director-workbench.tsx")).toContain("一键制作");
  expect(read("director-workbench.tsx")).not.toMatch(/director-oneclick[^"]*director-ask-ai/);
});
