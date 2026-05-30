"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 明星 · 模板脚本（v0.5 §3.2.7）
//   每个明星模板对应一份「prompt 集合」（文本模式）或挂参考视频（参考片模式）。
//   同一模板仅一条「已发布」生效，发布后小程序生成器立即用新版本。
//   极简版：列出 + 状态推进 + 试跑 + 骨架创建；结构化编辑器留 v0.6。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm, useToast } from "@/components/feedback";
import { TemplateScriptsApi } from "@/api";
import type { TemplateScript, TemplateScriptStatus, TemplateScriptKind } from "@/types/celebrity-zone";

const KINDS: TemplateScriptKind[] = ["text", "video_ref"];
const KIND_LABEL: Record<TemplateScriptKind, string> = {
  text: "纯文本脚本",
  video_ref: "参考视频",
};
const STATUSES: TemplateScriptStatus[] = ["draft", "in_review", "published", "archived"];
const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  in_review: "审核中",
  published: "已发布",
  archived: "已归档",
};
const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "info"> = {
  draft: "neutral",
  in_review: "warning",
  published: "success",
  archived: "info",
};

export default function TemplateScriptsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = React.useState<TemplateScript[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<{
    templateId?: string;
    status?: TemplateScriptStatus;
    kind?: TemplateScriptKind;
  }>({});
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
      toast.warning({ title: "模板编号 必填" });
      return;
    }
    try {
      const skel = {
        templateId: draft.templateId,
        kind: draft.kind,
        language: "zh-CN" as const,
        persona: {
          voiceTone: "亲切",
          speakingStyle: "短句口语化",
          personality: ["温暖"],
          forbiddenTone: [],
        },
        systemPrompt: "（请在编辑器里填具体内容）",
        scenes: [],
        visualStyle: { lighting: "柔和自然光", colorPalette: [], cinematography: "" },
        negativePrompt: "",
        variables: [
          {
            key: "productName",
            label: "商品名",
            type: "text" as const,
            source: "product" as const,
            required: true,
          },
        ],
        engineAdapters: {
          HiGen: {
            enabled: true,
            promptTemplate: "{{systemPrompt}}",
            params: { aspectRatio: "9:16" as const, fps: 30 as const },
          },
        },
        durationVariants: { 30: { sceneIds: [], cutHint: "硬切" } } as any,
        postProcess: {
          subtitleTemplate: "{{starName}} | {{productName}}",
          watermarkPolicy: "if_unauth" as const,
        },
        safety: { forbiddenWords: [], requiredDisclaimers: [] },
      };
      await TemplateScriptsApi.create(skel);
      setCreating(false);
      await refresh();
      toast.success({
        title: "脚本草稿已创建",
        description: "请打开详情接口补完场景与变量，再提审、发布。",
      });
    } catch (e) {
      toast.danger({ title: "创建失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onPublish(id: string) {
    try {
      await TemplateScriptsApi.publish(id);
      await refresh();
      toast.success({ title: "已发布", description: "旧的已发布版本已自动归档。" });
    } catch (e) {
      toast.danger({ title: "发布失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onSubmitReview(id: string) {
    try {
      await TemplateScriptsApi.submitReview(id);
      await refresh();
      toast.success({ title: "已提审" });
    } catch (e) {
      toast.danger({ title: "提审失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onRollback(s: TemplateScript) {
    const res = await confirm({
      title: "回滚到该归档版本",
      tone: "warning",
      confirmLabel: "确认回滚并发布",
      description: "把这条归档版本重新发布。当前的已发布版本会自动转为归档。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{s.templateId}</div>
          <div className="text-xs text-muted-foreground">
            版本 v{s.version} · 类型 {KIND_LABEL[s.kind]}
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    try {
      await TemplateScriptsApi.rollback(s.id);
      await refresh();
      toast.success({ title: "已回滚并重新发布" });
    } catch (e) {
      toast.danger({ title: "回滚失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onDryRun(id: string) {
    setDryRunResult("装配中…");
    try {
      const r = await TemplateScriptsApi.dryRun(id, {
        engine: "HiGen",
        durationSec: 30,
        product: {
          name: "测试商品",
          sellingPoints: "原料溯源;无添加;送礼",
          images: [],
        } as any,
        starId: "star-li-dan",
      });
      setDryRunResult(JSON.stringify(r, null, 2));
    } catch (e) {
      setDryRunResult("FAIL: " + (e instanceof Error ? e.message : ""));
    }
  }

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="模板脚本"
        description="为每个明星模板维护一份「prompt 集合」（纯文本）或挂参考视频。同一模板仅一条「已发布」生效，发布后立即对小程序生成器生效。"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选 / 操作</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">模板编号</div>
            <Input
              className="w-48"
              placeholder="如 tpl-001"
              value={filter.templateId ?? ""}
              onChange={(e) => setFilter({ ...filter, templateId: e.target.value || undefined })}
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">状态</div>
            <Select
              value={filter.status ?? "_all"}
              onValueChange={(v) =>
                setFilter({
                  ...filter,
                  status: v === "_all" ? undefined : (v as TemplateScriptStatus),
                })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">类型</div>
            <Select
              value={filter.kind ?? "_all"}
              onValueChange={(v) =>
                setFilter({ ...filter, kind: v === "_all" ? undefined : (v as TemplateScriptKind) })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部</SelectItem>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => void refresh()}>
            刷新
          </Button>
          <Button onClick={() => setCreating((v) => !v)}>{creating ? "取消" : "新建脚本"}</Button>
        </CardContent>
      </Card>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">新建脚本草稿</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              先生成骨架草稿，再到详情接口补完场景、变量、引擎适配。
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">模板编号</div>
                <Input
                  className="w-48"
                  value={draft.templateId}
                  onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">类型</div>
                <Select
                  value={draft.kind}
                  onValueChange={(v) => setDraft({ ...draft, kind: v as TemplateScriptKind })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void onCreate()}>生成骨架</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">脚本列表（{list.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模板编号</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">场景数</TableHead>
                  <TableHead>发布时间</TableHead>
                  <TableHead className="w-[360px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs font-mono">{s.templateId}</TableCell>
                    <TableCell className="tabular-nums">v{s.version}</TableCell>
                    <TableCell>
                      <Badge tone="neutral" className="font-normal">
                        {KIND_LABEL[s.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONE[String(s.status)] ?? "neutral"} className="font-normal">
                        {STATUS_LABEL[String(s.status)]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Array.isArray((s as any).scenes) ? (s as any).scenes.length : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{(s as any).publishedAt ?? "—"}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      {s.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => void onSubmitReview(s.id)}>
                          提审
                        </Button>
                      )}
                      {(s.status === "draft" || s.status === "in_review") && (
                        <Button size="sm" onClick={() => void onPublish(s.id)}>
                          发布
                        </Button>
                      )}
                      {s.status === "archived" && (
                        <Button size="sm" variant="outline" onClick={() => void onRollback(s)}>
                          回滚
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => void onDryRun(s.id)}>
                        试跑
                      </Button>
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
          <CardHeader>
            <CardTitle className="text-base">试跑结果</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[400px] overflow-auto rounded-md border border-border bg-foreground/95 p-3 text-xs text-background">
              {dryRunResult}
            </pre>
            <Button className="mt-3" variant="outline" onClick={() => setDryRunResult(null)}>
              关闭
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
