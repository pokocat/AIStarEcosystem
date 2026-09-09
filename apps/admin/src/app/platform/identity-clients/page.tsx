"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台与配置 · 统一登录接入
//
// 存在理由：接了哪些系统、哪个还活着，此前只能 ssh 上生产 cat 客户端清单才知道。
// 「我的账号」页上那块「已接入的产品」是**用户视角**（要产品后端主动回报才有行，
// 而且六个 web app 的 product_code 都是 aistar，最多显示一行），回答不了这个问题。
//
// 只读。生产客户端的唯一真源是账号中心那台机器上的 yaml，加一个产品 = 改配置 + 重启；
// 给这一页开写入口就等于让库和配置各说一套。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { AlertTriangle, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IdentityClientsApi } from "@/api";
import type { IdentityClientOverview, IdentityClientRow } from "@/api/identity-clients";

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 「多久没动静了」比一个绝对时间戳更能说明问题。 */
function sinceLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} 天前`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours} 小时前`;
  return "刚刚";
}

function ClientTable({ clients, activityAvailable }: { clients: IdentityClientRow[]; activityAvailable: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>接入端</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>授权方式</TableHead>
          <TableHead>回跳地址</TableHead>
          <TableHead className="text-right">最近发令牌</TableHead>
          <TableHead className="text-right">近 7 天</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.clientId} className={c.disabled ? "opacity-60" : undefined}>
            <TableCell>
              <div className="font-medium">
                {c.displayName || c.clientId}
                {c.disabled && <Badge tone="warning" className="ml-2">已退役</Badge>}
              </div>
              <div className="text-xs text-muted-foreground font-mono">{c.clientId}</div>
              {c.wechatAppId && (
                <div className="text-xs text-muted-foreground">微信 appid：{c.wechatAppId}</div>
              )}
            </TableCell>
            <TableCell>
              <Badge tone={c.publicClient ? "info" : "neutral"}>
                {c.publicClient ? "公开（PKCE）" : "机密"}
              </Badge>
              {c.audience && <div className="text-xs text-muted-foreground mt-1">aud：{c.audience}</div>}
            </TableCell>
            <TableCell className="text-xs">
              {c.grants.map((g) => (
                <div key={g} className="font-mono">{g.replace("urn:aibuzz:params:oauth:grant-type:", "")}</div>
              ))}
              {c.scopes.length > 0 && (
                <div className="text-muted-foreground mt-1">scope：{c.scopes.join(" ")}</div>
              )}
            </TableCell>
            <TableCell className="text-xs font-mono break-all max-w-[22rem]">
              {c.redirectUris.length === 0 ? <span className="text-muted-foreground">—</span>
                : c.redirectUris.map((u) => <div key={u}>{u}</div>)}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              {!activityAvailable ? <span className="text-muted-foreground">暂不可用</span>
                : c.lastTokenAt ? (
                  <>
                    <div>{fmtTime(c.lastTokenAt)}</div>
                    <div className="text-xs text-muted-foreground">{sinceLabel(c.lastTokenAt)}</div>
                  </>
                ) : <span className="text-amber-600">从未</span>}
            </TableCell>
            <TableCell className="text-right">
              {!activityAvailable || c.tokens7d === null
                ? <span className="text-muted-foreground">—</span>
                : c.tokens7d}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function IdentityClientsPage() {
  const [data, setData] = React.useState<IdentityClientOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setData(await IdentityClientsApi.getIdentityClientOverview());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // 「从没换过令牌」= 登记了但从来没真跑起来，这一页最该被看见的东西。
  const neverUsed = React.useMemo(() => {
    if (!data || !data.activityAvailable) return 0;
    return data.products.reduce(
      (n, p) => n + p.clients.filter((c) => !c.disabled && !c.lastTokenAt).length, 0);
  }, [data]);

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="统一登录接入"
        description="账号中心注册了哪些客户端、各自最近还在不在换令牌。只读 —— 加一个接入端是改账号中心的配置并重启，不在这里操作。"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />刷新
          </Button>
        }
      />

      {err && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">加载失败：{err}</CardContent>
        </Card>
      )}

      {data?.error && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              {data.configured ? "读取账号中心失败" : "尚未配置"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{data.error}</p>
            <p className="text-muted-foreground">
              账号中心地址：<span className="font-mono">{data.issuer || "（未配置）"}</span>
            </p>
            <p className="text-muted-foreground">
              下面不显示任何客户端 —— 这表示<b>没读到</b>，不是「一个系统都没接」。
            </p>
          </CardContent>
        </Card>
      )}

      {data && !data.error && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="接入的产品" value={String(data.productCount)} icon={PlugZap} />
            <StatCard label="接入端（客户端）" value={String(data.clientCount)} icon={ShieldCheck} hint="同一产品下 web / 小程序 / 后端各算一个" />
            <StatCard
              label="登记了但从没用过"
              value={data.activityAvailable ? String(neverUsed) : "—"}
              icon={AlertTriangle}
              tone={neverUsed > 0 ? "warning" : "default"}
              hint="清单里有、但从来没换出过令牌"
            />
          </div>

          {!data.activityAvailable && (
            <Card className="border-amber-500">
              <CardContent className="pt-6 text-sm">
                账号中心这次没取到活跃度统计，「最近发令牌 / 近 7 天」两列显示为暂不可用 ——
                <b>不是「从没用过」</b>。客户端清单本身仍然是准的。
              </CardContent>
            </Card>
          )}

          {data.products.map((p) => (
            <Card key={p.productCode}>
              <CardHeader>
                <CardTitle className="text-base">
                  {p.displayName}
                  <span className="ml-2 text-xs font-mono text-muted-foreground">{p.productCode}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.clients.length} 个接入端</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClientTable clients={p.clients} activityAvailable={data.activityAvailable} />
              </CardContent>
            </Card>
          ))}

          <p className="text-xs text-muted-foreground">
            快照时间 {fmtTime(data.generatedAt)}（账号中心 {data.issuer}）。
            同一个产品下会有 web / 小程序 / 后端多个接入端 —— 产品是计费与权益的维度，接入端才是应用的维度。
          </p>
        </>
      )}

      {loading && !data && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">加载中…</CardContent></Card>
      )}
    </div>
  );
}
