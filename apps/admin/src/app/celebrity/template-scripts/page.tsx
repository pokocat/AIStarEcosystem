"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 明星 · 模板脚本（v0.5 §3.2.7 新增）
// 极简版：列出脚本 + 状态推进 + 试跑 + 简单创建（最小可用）
// 完整结构化编辑器（场景时间线 / 三 Tab 引擎适配 / 富 dry-run UI）留给 v0.6 上线。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TemplateScriptsApi } from "@/api";
import type { TemplateScript, TemplateScriptStatus, TemplateScriptKind } from "@/types/celebrity-zone";

const KINDS: TemplateScriptKind[] = ["text", "video_ref"];
const STATUSES: TemplateScriptStatus[] = ["draft", "in_review", "published", "archived"];
const STATUS_LABEL: Record<string, string> = {
  draft: "草稿", in_review: "审核中", published: "已发布", archived: "已归档",
};

export default function TemplateScriptsPage() {
  const [list, setList] = React.useState<TemplateScript[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<{ templateId?: string; status?: TemplateScriptStatus; kind?: TemplateScriptKind }>({});
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState({ templateId: "tpl-001", kind: "text" as TemplateScriptKind });
  const [dryRunResult, setDryRunResult] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await TemplateScriptsApi.list(filter));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    if (!draft.templateId.trim()) {
      alert("templateId 必填");
      return;
    }
    try {
      // v0.5 创建后默认骨架；运营后续在 PUT 接口里补完
      const skel = {
        templateId: draft.templateId,
        kind: draft.kind,
        language: "zh-CN" as const,
        persona: { voiceTone: "亲切", speakingStyle: "短句口语化", personality: ["温暖"], forbiddenTone: [] },
        systemPrompt: "（请在编辑器里填具体内容）",
        scenes: [],
        visualStyle: { lighting: "柔和自然光", colorPalette: [], cinematography: "" },
        negativePrompt: "",
        variables: [{ key: "productName", label: "商品名", type: "text" as const, source: "product" as const, required: true }],
        engineAdapters: { HiGen: { enabled: true, promptTemplate: "{{systemPrompt}}", params: { aspectRatio: "9:16" as const, fps: 30 as const } } },
        durationVariants: { 30: { sceneIds: [], cutHint: "硬切" } } as any,
        postProcess: { subtitleTemplate: "{{starName}} | {{productName}}", watermarkPolicy: "if_unauth" as const },
        safety: { forbiddenWords: [], requiredDisclaimers: [] },
      };
      await TemplateScriptsApi.create(skel);
      setCreating(false);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    }
  }
  async function onPublish(id: string) {
    try {
      await TemplateScriptsApi.publish(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "发布失败");
    }
  }
  async function onSubmitReview(id: string) {
    try {
      await TemplateScriptsApi.submitReview(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "提审失败");
    }
  }
  async function onRollback(id: string) {
    if (!confirm("把已归档版本重新发布（旧 published 自动归档）？")) return;
    try {
      await TemplateScriptsApi.rollback(id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "回滚失败");
    }
  }
  async function onDryRun(id: string) {
    setDryRunResult("装配中…");
    try {
      const r = await TemplateScriptsApi.dryRun(id, {
        engine: "HiGen",
        durationSec: 30,
        product: { name: "测试商品", sellingPoints: "原料溯源;无添加;送礼", images: [] } as any,
        starId: "star-li-dan",
      });
      setDryRunResult(JSON.stringify(r, null, 2));
    } catch (e) {
      setDryRunResult("FAIL: " + (e instanceof Error ? e.message : ""));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="模板脚本"
        description="为每个 CelebrityTemplate 维护一份「prompt 集合」（text 模式）或挂参考视频（video_ref 模式）。同一模板仅一条 published 生效，发布即对小程序生成器立即生效。"
      />

      <Card>
        <CardHeader><CardTitle>筛选 / 创建</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">templateId</div>
            <Input className="w-48" placeholder="如 tpl-001" value={filter.templateId ?? ""} onChange={(e) => setFilter({ ...filter, templateId: e.target.value || undefined })} />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">status</div>
            <Select value={filter.status ?? "_all"} onValueChange={(v) => setFilter({ ...filter, status: (v === "_all" ? undefined : (v as TemplateScriptStatus)) })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">kind</div>
            <Select value={filter.kind ?? "_all"} onValueChange={(v) => setFilter({ ...filter, kind: (v === "_all" ? undefined : (v as TemplateScriptKind)) })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部</SelectItem>
                {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => void refresh()}>刷新</Button>
          <Button onClick={() => setCreating((v) => !v)}>{creating ? "取消" : "新建脚本"}</Button>
        </CardContent>
      </Card>

      {creating && (
        <Card>
          <CardHeader><CardTitle>新建脚本（创建后跳到 PUT 详情接口完善内容）</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">templateId</div>
              <Input className="w-48" value={draft.templateId} onChange={(e) => setDraft({ ...draft, templateId: e.target.value })} />
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">kind</div>
              <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as TemplateScriptKind })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => void onCreate()}>提交（生成骨架草稿）</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>脚本列表（{list.length}）</CardTitle></CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-rose-600">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>templateId</TableHead>
                  <TableHead>version</TableHead>
                  <TableHead>kind</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>scenes</TableHead>
                  <TableHead>publishedAt</TableHead>
                  <TableHead className="w-[360px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs font-mono">{s.templateId}</TableCell>
                    <TableCell>v{s.version}</TableCell>
                    <TableCell><span className="rounded bg-slate-100 px-1 text-xs">{s.kind}</span></TableCell>
                    <TableCell>{STATUS_LABEL[String(s.status)]}</TableCell>
                    <TableCell>{Array.isArray((s as any).scenes) ? (s as any).scenes.length : "—"}</TableCell>
                    <TableCell className="text-xs">{(s as any).publishedAt ?? "—"}</TableCell>
                    <TableCell className="space-x-1">
                      {s.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => void onSubmitReview(s.id)}>提审</Button>
                      )}
                      {(s.status === "draft" || s.status === "in_review") && (
                        <Button size="sm" onClick={() => void onPublish(s.id)}>发布</Button>
                      )}
                      {s.status === "archived" && (
                        <Button size="sm" variant="outline" onClick={() => void onRollback(s.id)}>回滚</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => void onDryRun(s.id)}>试跑</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {dryRunResult && (
        <Card>
          <CardHeader><CardTitle>试跑结果</CardTitle></CardHeader>
          <CardContent>
            <pre className="max-h-[400px] overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{dryRunResult}</pre>
            <Button className="mt-2" variant="outline" onClick={() => setDryRunResult(null)}>关闭</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
