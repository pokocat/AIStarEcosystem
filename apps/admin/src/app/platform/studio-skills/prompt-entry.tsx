"use client";

// 提示词库条目（底座、环节、内容方法、场景）的编辑面板：和制作做法共用这一页、同一套版本与回滚，
// 只是没有做法的表单，改正文发布新版本；环节可以预览按调用点拼出来的完整提示词。真源：docs/studio-prompt-architecture.md §7。

import * as React from "react";
import { Eye, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StudioSkillsApi } from "@/api";
import type { StudioPromptPreviewResult, StudioSkillAdminDetail } from "@/types/studio-skills";
import { ErrorList, errorLines } from "./parts";

export const LAYER_LABEL: Record<string, string> = { base: "底座", stage: "环节", method: "方法", scene: "场景" };
export const TARGET_LABEL: Record<string, string> = { llm: "大模型", "image-model": "画图模型", "video-model": "视频模型", message: "拼成一段话" };

/** 提示词库条目（不是制作做法）。 */
export function isPromptEntry(item: { layer?: string; kind?: string }) {
  return !!item.layer && !(item.layer === "method" && (item.kind ?? "workflow") === "workflow");
}

/** 列表里的一行说明：哪一层、给谁看。 */
export function entryLine(item: { layer?: string; kind?: string; target?: string }) {
  if (item.layer === "method") return item.kind === "content" ? "内容方法" : "制作做法";
  return [LAYER_LABEL[item.layer ?? ""] ?? item.layer, item.target ? TARGET_LABEL[item.target] ?? item.target : ""].filter(Boolean).join(" · ");
}

export function PromptEntryPanel({ detail, onPublished }: { detail: StudioSkillAdminDetail; onPublished: () => void }) {
  const [body, setBody] = React.useState(detail.current.bodyMd);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string[]>([]);
  const [scene, setScene] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [preview, setPreview] = React.useState<StudioPromptPreviewResult | null>(null);
  const [previewError, setPreviewError] = React.useState<string[]>([]);
  React.useEffect(() => { setBody(detail.current.bodyMd); setNote(""); setError([]); setPreview(null); setPreviewError([]); }, [detail.key, detail.currentVersion, detail.current.bodyMd]);
  const dirty = body !== detail.current.bodyMd;
  const stage = detail.layer === "stage";

  const publish = async () => {
    setBusy(true); setError([]);
    try {
      await StudioSkillsApi.publishStudioSkillVersion(detail.key, { frontmatter: detail.current.frontmatter, bodyMd: body, note: note.trim() || undefined, expectedVersion: detail.currentVersion });
      onPublished();
    } catch (e) { setError(errorLines(e)); } finally { setBusy(false); }
  };
  const runPreview = async () => {
    setPreviewError([]);
    try { setPreview(await StudioSkillsApi.previewStudioPrompt({ stage: detail.key, scene: scene.trim() || undefined, method: method.trim() || undefined })); }
    catch (e) { setPreviewError(errorLines(e)); setPreview(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{entryLine(detail)}</Badge>
            <Badge tone="neutral">当前 v{detail.currentVersion}</Badge>
            {detail.seedFile && <Badge tone="neutral" title={`仓内文件 ${detail.seedFile}`}>来自仓内文件</Badge>}
          </div>
          <CardTitle className="truncate text-base" title={detail.name}>{detail.name}</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">{detail.summary}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">正文</span>
            {stage && <p className="text-xs leading-5 text-muted-foreground">一行 <code>---</code> 分开 system 和 user 两段。{"{{base}} {{method}} {{scene}}"} 是其它层放的位置，{"{{format.…}}"} 是代码提供的输出格式，都不能删；能用的变量见下面的预览。</p>}
            <Textarea aria-label="正文" className="min-h-[360px] font-mono text-xs leading-5" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <details className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">文件头（只读）</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(detail.current.frontmatter, null, 2)}</pre>
          </details>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="版本说明" className="min-w-[200px] flex-1" placeholder="这一版改了什么（可选）" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={!dirty || busy} onClick={() => void publish()}><Upload className="h-4 w-4" />{busy ? "发布中…" : "发布新版本"}</Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">发布后立即生效；已经开始的任务按它开始时的版本执行。格式不对、用了调用点没登记的变量，服务端会拒绝发布并说明原因。</p>
          <ErrorList lines={error} />
        </CardContent>
      </Card>

      {stage && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">预览</CardTitle>
            <p className="text-xs leading-5 text-muted-foreground">用调用点的示例输入按当前版本拼一次，不调模型、不花钱。要看某个场景或内容方法，填它的 key。</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input aria-label="场景 key" className="w-56" placeholder="场景，如 scene-local-groupbuy" value={scene} onChange={(e) => setScene(e.target.value)} />
              <Input aria-label="内容方法 key" className="w-56" placeholder="内容方法（可选）" value={method} onChange={(e) => setMethod(e.target.value)} />
              <Button variant="outline" onClick={() => void runPreview()}><Eye className="h-4 w-4" />拼一次看看</Button>
            </div>
            <ErrorList lines={previewError} />
            {preview && (
              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground">用到：{preview.refs.map((r) => `${r.key} v${r.version}`).join("、")}</p>
                {preview.system && <Block title="system" text={preview.system} />}
                <Block title="user" text={preview.user} />
                {Object.entries(preview.formats).filter(([, t]) => t).map(([name, text]) => <Block key={name} title={`输出格式 {{format.${name}}}（代码生成，只读）`} text={text} muted />)}
                <details className="rounded-md border border-border px-3 py-2">
                  <summary className="cursor-pointer text-muted-foreground">能用的变量</summary>
                  <ul className="mt-2 space-y-1">{Object.entries(preview.variables).map(([k, v]) => <li key={k}><code>{`{{${k}}}`}</code>：{v}</li>)}</ul>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Block({ title, text, muted }: { title: string; text: string; muted?: boolean }) {
  return (
    <div className="space-y-1">
      <span className="font-medium">{title}</span>
      <pre className={`max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border px-3 py-2 leading-5 ${muted ? "bg-surface-muted text-muted-foreground" : "bg-card"}`}>{text}</pre>
    </div>
  );
}
