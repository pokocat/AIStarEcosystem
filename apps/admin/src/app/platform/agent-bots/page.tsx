"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台 · Agent 平台配置（v0.39）
//   接入 Coze 等 agent 平台的 bot（形象锻造等场景），token 由 server 用 AES-GCM 加密落库。
//   一个业务场景（sceneKey）对应一个 bot；前端业务按 sceneKey 取配置。
//   本期 chat 真实可用的是 Coze；DIFY / 自定义 预留。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, ShieldCheck, ChevronRight, Settings2, ExternalLink } from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback";
import { AgentBotsApi } from "@/api";
import { cn } from "@/lib/utils";
import type { AgentBotProvider, AgentPlatform, AgentScene } from "@/api/agent-bots";

const PLATFORMS: AgentPlatform[] = ["coze", "dify", "custom"];

const PLATFORM_LABEL: Record<AgentPlatform, string> = {
  coze: "Coze 扣子",
  dify: "Dify",
  custom: "自定义",
};

const SUPPORTED_PLATFORMS = new Set<AgentPlatform>(["coze"]);

/** 由 apiBase 推断 Coze 控制台域名（国内 coze.cn / 海外 coze.com）。 */
function cozeConsoleHost(apiBase?: string): string {
  return (apiBase ?? "").toLowerCase().includes("coze.com")
    ? "https://www.coze.com"
    : "https://www.coze.cn";
}

/**
 * 拼「打开 bot 配置页」深链。Coze 的开发页需要 space 上下文：
 *   {host}/space/{spaceId}/bot/{botId}
 * 没填 spaceId 时退回控制台首页（仍可点，进去自己找）。仅 coze 平台返回链接。
 */
function cozeBotUrl(p: { platform: AgentPlatform; apiBase?: string; botId?: string; spaceId?: string }): string | null {
  if (p.platform !== "coze" || !p.botId) return null;
  const host = cozeConsoleHost(p.apiBase);
  return p.spaceId ? `${host}/space/${p.spaceId}/bot/${p.botId}` : host;
}

/**
 * 从粘贴的 Coze bot 编辑页链接里拆出 apiBase / spaceId / botId。
 * 支持 www.coze.cn|coze.com/space/{spaceId}/bot/{botId}（容忍尾部 query/hash），
 * 以及无 space 段的 .../bot/{botId}。识别不出返回 null。
 */
function parseCozeBotUrl(raw: string): { apiBase?: string; spaceId?: string; botId?: string } | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const out: { apiBase?: string; spaceId?: string; botId?: string } = {};
  if (host.includes("coze.com")) out.apiBase = "https://api.coze.com";
  else if (host.includes("coze.cn")) out.apiBase = "https://api.coze.cn";

  const withSpace = u.pathname.match(/\/space\/([^/]+)\/bot\/([^/?#]+)/);
  if (withSpace) {
    out.spaceId = withSpace[1];
    out.botId = withSpace[2];
  } else {
    const botOnly = u.pathname.match(/\/bot\/([^/?#]+)/);
    if (botOnly) out.botId = botOnly[1];
  }
  if (!out.botId && !out.spaceId) return null;
  return out;
}

interface FormState {
  id?: string;
  name: string;
  platform: AgentPlatform;
  sceneKey: string;
  apiBase: string;
  token: string;
  botId: string;
  spaceId: string;
  userIdPrefix: string;
  readTimeoutMs: number;
  description: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  platform: "coze",
  sceneKey: "appearance-forge",
  apiBase: "https://api.coze.cn",
  token: "",
  botId: "",
  spaceId: "",
  userIdPrefix: "aep-producer-",
  readTimeoutMs: 120000,
  description: "",
  enabled: true,
};

export default function AdminAgentBotsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = React.useState<AgentBotProvider[]>([]);
  const [scenes, setScenes] = React.useState<AgentScene[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<FormState | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [pasteUrl, setPasteUrl] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setList(await AgentBotsApi.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    void AgentBotsApi.listScenes()
      .then(setScenes)
      .catch(() => {
        /* 场景目录拉取失败不阻塞页面 */
      });
  }, []);

  const sceneLabel = React.useCallback(
    (key: string) => scenes.find((s) => s.key === key)?.label ?? key,
    [scenes],
  );

  async function onSave() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.sceneKey.trim() || !editing.botId.trim()) {
      toast.warning({ title: "名称 / 场景 / Bot ID 必填" });
      return;
    }
    if (!editing.id && !editing.token.trim()) {
      toast.warning({ title: "新建时 访问 Token 必填" });
      return;
    }
    try {
      const body = {
        name: editing.name.trim(),
        platform: editing.platform,
        sceneKey: editing.sceneKey.trim(),
        apiBase: editing.apiBase.trim() || undefined,
        ...(editing.token.trim() ? { token: editing.token.trim() } : {}),
        botId: editing.botId.trim(),
        spaceId: editing.spaceId.trim() || undefined,
        userIdPrefix: editing.userIdPrefix.trim() || undefined,
        readTimeoutMs: editing.readTimeoutMs || undefined,
        description: editing.description.trim() || undefined,
        enabled: editing.enabled,
      };
      if (editing.id) {
        await AgentBotsApi.update(editing.id, body);
      } else {
        await AgentBotsApi.create(body);
      }
      setEditing(null);
      setShowAdvanced(false);
      setPasteUrl("");
      await refresh();
      toast.success({ title: editing.id ? "已保存" : "Bot 已创建" });
    } catch (e) {
      toast.danger({ title: "保存失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onDelete(p: AgentBotProvider) {
    const res = await confirm({
      title: "删除 Agent Bot 配置",
      tone: "danger",
      confirmLabel: "确认删除",
      requireReason: true,
      reasonPlaceholder: "例如：token 泄漏 / 已换 bot",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">
            平台：{PLATFORM_LABEL[p.platform]} · 场景：{sceneLabel(p.sceneKey)}
          </div>
          <div className="text-xs text-muted-foreground">
            Bot 编号 <span className="font-mono">{p.id}</span>
          </div>
        </div>
      ),
      description: "删除后绑定该场景的功能（如形象锻造）会回退到 env 兜底，或在未配 env 时变为「未配置」。",
    });
    if (!res.ok) return;
    try {
      await AgentBotsApi.remove(p.id);
      await refresh();
      toast.success({ title: "已删除" });
    } catch (e) {
      toast.danger({ title: "删除失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  function applyPastedUrl() {
    if (!editing) return;
    const parsed = parseCozeBotUrl(pasteUrl);
    if (!parsed) {
      toast.warning({
        title: "无法识别链接",
        description: "请粘贴形如 https://www.coze.cn/space/<spaceId>/bot/<botId> 的地址",
      });
      return;
    }
    setEditing({
      ...editing,
      ...(parsed.apiBase ? { apiBase: parsed.apiBase } : {}),
      ...(parsed.botId ? { botId: parsed.botId } : {}),
      ...(parsed.spaceId ? { spaceId: parsed.spaceId } : {}),
    });
    setPasteUrl("");
    const bits = [parsed.botId && `Bot ${parsed.botId}`, parsed.spaceId && `Space ${parsed.spaceId}`]
      .filter(Boolean)
      .join(" · ");
    toast.success({ title: "已自动填充", description: bits || undefined });
  }

  // 场景下拉：已知目录 + 当前编辑值（兼容历史自定义 sceneKey）。
  const sceneOptions = React.useMemo(() => {
    const keys = new Map<string, string>();
    scenes.forEach((s) => keys.set(s.key, s.label));
    if (editing?.sceneKey && !keys.has(editing.sceneKey)) keys.set(editing.sceneKey, editing.sceneKey);
    return Array.from(keys.entries()).map(([key, label]) => ({ key, label }));
  }, [scenes, editing?.sceneKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent 平台配置"
        description="接入 Coze 等 agent 平台的 bot（形象锻造等场景使用）。访问 Token 由服务端加密存储，列表仅显示脱敏值。一个场景对应一个 bot。"
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">
            {editing ? (editing.id ? "编辑 Bot" : "新建 Bot") : "操作"}
          </CardTitle>
          {!editing && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void refresh()}>
                刷新
              </Button>
              <Button onClick={() => setEditing({ ...EMPTY_FORM, sceneKey: scenes[0]?.key ?? EMPTY_FORM.sceneKey })}>
                新建 Bot
              </Button>
            </div>
          )}
        </CardHeader>
        {editing && (
          <CardContent className="space-y-5">
            <section className="rounded-md border border-dashed border-border bg-surface-muted/30 p-3">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                快速填充：粘贴 Coze bot 编辑页链接，自动拆出 Bot ID / Space ID / 调用地址
              </div>
              <div className="flex gap-2">
                <Input
                  value={pasteUrl}
                  onChange={(e) => setPasteUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyPastedUrl();
                    }
                  }}
                  placeholder="https://www.coze.cn/space/74xxxx/bot/74xxxx"
                />
                <Button type="button" variant="outline" onClick={applyPastedUrl}>
                  解析填充
                </Button>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="名称" hint="给运营用的备注，例如「形象锻造 · 主用 bot」">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="形象锻造 · 主用 bot"
                />
              </Field>
              <Field
                label="平台"
                hint={SUPPORTED_PLATFORMS.has(editing.platform) ? "本期 chat 已真实接通" : "本期尚未接通，可建档但不生效"}
              >
                <Select
                  value={editing.platform}
                  onValueChange={(v) => setEditing({ ...editing, platform: v as AgentPlatform })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        <div className="flex items-center gap-2">
                          <span>{PLATFORM_LABEL[t]}</span>
                          {!SUPPORTED_PLATFORMS.has(t) && (
                            <span className="text-[10px] text-muted-foreground">未接通</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="绑定场景" hint="一个场景只能对应一个 bot；新功能需先在后端目录登记 sceneKey">
                <Select
                  value={editing.sceneKey}
                  onValueChange={(v) => setEditing({ ...editing, sceneKey: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sceneOptions.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}（{s.key}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Bot ID" hint="Coze bot id（Dify 时为 app id）">
                <Input
                  value={editing.botId}
                  onChange={(e) => setEditing({ ...editing, botId: e.target.value })}
                  placeholder="74xxxxxxxxxxxxxxxxx"
                />
              </Field>
              <Field
                label="Space ID"
                hint="可选；Coze 控制台 bot 编辑页 URL 里的 space 段（www.coze.cn/space/<这段>/bot/...）。填了才能直达 bot 配置页。"
              >
                <Input
                  value={editing.spaceId}
                  onChange={(e) => setEditing({ ...editing, spaceId: e.target.value })}
                  placeholder="74xxxxxxxxxxxxxxxxx"
                />
                {editing.platform === "coze" && editing.botId.trim() && (
                  <a
                    href={cozeBotUrl({
                      platform: editing.platform,
                      apiBase: editing.apiBase,
                      botId: editing.botId.trim(),
                      spaceId: editing.spaceId.trim() || undefined,
                    })!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {editing.spaceId.trim() ? "在 Coze 打开 bot 配置页" : "打开 Coze 控制台（未填 Space ID）"}
                  </a>
                )}
              </Field>
              <Field label="调用地址" hint="Coze 国内默认 https://api.coze.cn；海外 https://api.coze.com">
                <Input
                  value={editing.apiBase}
                  onChange={(e) => setEditing({ ...editing, apiBase: e.target.value })}
                  placeholder="https://api.coze.cn"
                />
              </Field>
              <Field
                label="访问 Token"
                hint={
                  editing.id
                    ? "留空表示不修改；填写则覆盖。服务端用 AES-GCM 加密落库。"
                    : "新建时必填。服务端用 AES-GCM 加密落库，仅在调用时解密。"
                }
              >
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    className="pl-8"
                    placeholder={editing.id ? "***（不修改）" : "pat_... / sat_..."}
                    value={editing.token}
                    onChange={(e) => setEditing({ ...editing, token: e.target.value })}
                  />
                </div>
              </Field>
              <Field label="启用" hint="关闭后该场景回退到 env 兜底或变为未配置">
                <div className="flex h-9 items-center">
                  <Switch
                    checked={editing.enabled}
                    onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                  />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {editing.enabled ? "已启用" : "已停用"}
                  </span>
                </div>
              </Field>
            </section>

            <section className="rounded-md border border-border bg-surface-muted/40">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" />
                  高级
                </span>
                <ChevronRight className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-90")} />
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-1 gap-4 border-t border-border p-3.5 md:grid-cols-2">
                  <Field label="用户 ID 前缀" hint="拼到 Coze userID 前，便于平台侧区分会话归属">
                    <Input
                      value={editing.userIdPrefix}
                      onChange={(e) => setEditing({ ...editing, userIdPrefix: e.target.value })}
                      placeholder="aep-producer-"
                    />
                  </Field>
                  <Field label="读超时（毫秒）" hint="流式锻造较慢，默认 120000">
                    <Input
                      type="number"
                      value={editing.readTimeoutMs}
                      onChange={(e) => setEditing({ ...editing, readTimeoutMs: Number(e.target.value) || 120000 })}
                    />
                  </Field>
                  <Field label="备注" hint="可选">
                    <Input
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      placeholder="留空"
                    />
                  </Field>
                </div>
              )}
            </section>

            <div className="flex gap-2 pt-1">
              <Button onClick={() => void onSave()}>{editing.id ? "保存修改" : "新建"}</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setShowAdvanced(false);
                  setPasteUrl("");
                }}
              >
                取消
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Bot 列表（{list.length}）</span>
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Token 加密存储
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && list.length === 0 && (
            <div className="text-sm text-muted-foreground">
              还没有配置。点「新建 Bot」为「形象锻造」场景接入一个 Coze bot。
            </div>
          )}
          {!loading && !err && list.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>场景</TableHead>
                  <TableHead>Bot ID</TableHead>
                  <TableHead>调用地址</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-[180px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{p.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral" className="font-normal">
                        {PLATFORM_LABEL[p.platform] ?? p.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{sceneLabel(p.sceneKey)}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{p.sceneKey}</div>
                    </TableCell>
                    <TableCell className="max-w-[180px] text-xs font-mono">
                      {(() => {
                        const url = cozeBotUrl(p);
                        return url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={p.spaceId ? "在 Coze 打开 bot 配置页" : "打开 Coze 控制台（未填 Space ID，无法直达 bot）"}
                            className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                          >
                            <span className="truncate">{p.botId}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="block truncate">{p.botId}</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs font-mono">{p.apiBase}</TableCell>
                    <TableCell className="text-xs font-mono">{p.tokenMasked}</TableCell>
                    <TableCell>
                      {p.enabled ? (
                        <Badge tone="success" className="font-normal">
                          已启用
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className="font-normal text-muted-foreground">
                          已停用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            id: p.id,
                            name: p.name,
                            platform: p.platform,
                            sceneKey: p.sceneKey,
                            apiBase: p.apiBase ?? "https://api.coze.cn",
                            token: "",
                            botId: p.botId,
                            spaceId: p.spaceId ?? "",
                            userIdPrefix: p.userIdPrefix ?? "aep-producer-",
                            readTimeoutMs: p.readTimeoutMs ?? 120000,
                            description: p.description ?? "",
                            enabled: p.enabled,
                          })
                        }
                      >
                        编辑
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void onDelete(p)}>
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
