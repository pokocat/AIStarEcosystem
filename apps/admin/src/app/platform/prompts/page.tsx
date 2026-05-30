"use client";

// Prompt 管理 —— 素材运营文本三件的 system + user 模板（DB 真源，admin 可改/灰度/回滚）。
// 对应 server AdminPromptController（/api/admin/prompts/*）+ PromptService（1min 缓存，PUT 立即失效）。

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FlaskConical, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/components/feedback";
import { PromptsApi } from "@/api";
import type { PromptTemplate, PromptDryRun } from "@/api/prompts";

const KEY_LABEL: Record<string, string> = {
  "material.script_draft": "脚本 AI 起稿",
  "material.selling_points": "商品卖点提取",
  "material.variable_extract": "脚本变量抽取",
};

// 试运行的样例参数（与 server PromptService.fill 的占位符对齐）。
const KEY_SAMPLE: Record<string, Record<string, string>> = {
  "material.script_draft": {
    product_name: "便携颈部按摩仪",
    category: "个护健康",
    price: "¥229.00",
    selling_points: "轻便随身 / 久坐党救星 / 三档力度",
    audience: "打工人、宝妈",
    tone: "情感故事",
    duration_sec: "38",
    count: "3",
    banned_words: "最、第一、100%、根治",
  },
  "material.selling_points": {
    name: "便携颈部按摩仪",
    link: "https://haohuo.jinritemai.com/ecommerce/trade/detail/index.html?id=demo",
  },
  "material.variable_extract": {
    script_blocks: "镜0：修了 30 年车，第一次给老婆买按摩仪\n镜1：从口袋拿出 · 老婆惊讶反应",
  },
};

export default function PromptsPage() {
  const toast = useToast();
  const [list, setList] = React.useState<PromptTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  // 编辑态
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [userTemplate, setUserTemplate] = React.useState("");
  const [temperature, setTemperature] = React.useState("");
  const [maxTokens, setMaxTokens] = React.useState("");
  const [jsonMode, setJsonMode] = React.useState(true);
  const [enabled, setEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // 试运行
  const [sampleVars, setSampleVars] = React.useState("{}");
  const [dryRun, setDryRun] = React.useState<PromptDryRun | null>(null);
  const [dryRunning, setDryRunning] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await PromptsApi.listPrompts();
      setList(rows);
      setActiveKey((prev) => prev ?? rows[0]?.promptKey ?? null);
    } catch (e) {
      toast.danger({ title: "加载失败", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const active = list.find((p) => p.promptKey === activeKey) ?? null;

  // 选中 prompt 时把编辑态灌进表单
  React.useEffect(() => {
    if (!active) return;
    setSystemPrompt(active.systemPrompt ?? "");
    setUserTemplate(active.userTemplate ?? "");
    setTemperature(active.params?.temperature != null ? String(active.params.temperature) : "");
    setMaxTokens(active.params?.maxTokens != null ? String(active.params.maxTokens) : "");
    setJsonMode(active.params?.jsonMode !== false);
    setEnabled(active.enabled);
    setSampleVars(JSON.stringify(KEY_SAMPLE[active.promptKey] ?? {}, null, 2));
    setDryRun(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const save = async () => {
    if (!activeKey) return;
    setSaving(true);
    try {
      await PromptsApi.upsertPrompt(activeKey, {
        systemPrompt,
        userTemplate,
        params: {
          temperature: temperature.trim() === "" ? null : Number(temperature),
          maxTokens: maxTokens.trim() === "" ? null : Number(maxTokens),
          jsonMode,
        },
        enabled,
      });
      toast.success({ title: "已保存", description: "1 分钟内全节点生效" });
      await load();
    } catch (e) {
      toast.danger({ title: "保存失败", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const runDryRun = async () => {
    if (!activeKey) return;
    setDryRunning(true);
    try {
      let vars: Record<string, string> = {};
      try {
        vars = JSON.parse(sampleVars || "{}");
      } catch {
        toast.danger({ title: "样例参数不是合法 JSON" });
        setDryRunning(false);
        return;
      }
      const result = await PromptsApi.dryRunPrompt(activeKey, vars);
      setDryRun(result);
    } catch (e) {
      toast.danger({ title: "试运行失败", description: (e as Error).message });
    } finally {
      setDryRunning(false);
    }
  };

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="Prompt 管理"
        description="素材运营文本能力（脚本起稿 / 卖点提取 / 变量抽取）的 system + user 模板。改完保存即生效，无需改代码或重启。占位符形如 {{name}}，调用时按业务参数填充。"
      />

      <div className="grid grid-cols-[260px_1fr] gap-6">
        {/* 左：prompt 列表 */}
        <div className="space-y-2">
          {loading && <div className="text-sm text-muted-foreground px-2">加载中…</div>}
          {list.map((p) => {
            const isActive = p.promptKey === activeKey;
            return (
              <button
                key={p.promptKey}
                onClick={() => setActiveKey(p.promptKey)}
                className={
                  "w-full text-left rounded-lg border px-3 py-2.5 transition " +
                  (isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{KEY_LABEL[p.promptKey] ?? p.promptKey}</span>
                  {!p.enabled && <Badge tone="neutral" className="text-[10px]">已停用</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>{p.promptKey}</span>
                  <span>· v{p.version}</span>
                  {p.version > 1 && <span className="text-amber-600">运营已改</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* 右：编辑器 */}
        {active ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {KEY_LABEL[active.promptKey] ?? active.promptKey}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{active.promptKey}</span>
                </CardTitle>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={enabled} onCheckedChange={setEnabled} />
                    启用
                  </label>
                  <Button onClick={save} disabled={saving}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saving ? "保存中…" : "保存"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1.5 text-sm font-medium">System Prompt</div>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                    User 模板
                    <span className="font-mono text-[10px] font-normal text-muted-foreground">
                      占位符 {"{{key}}"} 调用时按业务参数填充
                    </span>
                  </div>
                  <Textarea
                    value={userTemplate}
                    onChange={(e) => setUserTemplate(e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <div className="mb-1.5 text-sm font-medium">temperature</div>
                    <Input
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="0.7"
                      className="w-28"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm font-medium">max_tokens</div>
                    <Input
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                      placeholder="2048"
                      className="w-28"
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <Switch checked={jsonMode} onCheckedChange={setJsonMode} />
                    JSON 模式（response_format）
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* 试运行 */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlaskConical className="h-4 w-4" /> 试运行（仅填充，不调模型）
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSampleVars(JSON.stringify(KEY_SAMPLE[active.promptKey] ?? {}, null, 2))}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 样例
                  </Button>
                  <Button size="sm" onClick={runDryRun} disabled={dryRunning}>
                    {dryRunning ? "运行中…" : "试运行"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1.5 text-sm font-medium">样例参数（JSON）</div>
                  <Textarea
                    value={sampleVars}
                    onChange={(e) => setSampleVars(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
                {dryRun && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">填充后 system</div>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{dryRun.system}</pre>
                    <div className="text-sm font-medium">填充后 user</div>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{dryRun.user}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          !loading && <div className="text-sm text-muted-foreground">暂无可配置的 prompt</div>
        )}
      </div>
    </div>
  );
}
