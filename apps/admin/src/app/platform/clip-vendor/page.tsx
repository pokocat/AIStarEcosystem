"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台与配置 · 石榴AI 供应商管理
//
// 存在理由：额度耗尽此前只能靠翻服务器日志才知道，而槽位被「孤儿」占满同样无声无息 ——
// 我方软删了本地记录、上游删除却失败，那个对象就永远占着一个槽位，直到某天用户建不出新形象。
//
// 只读视图。清理孤儿 / 悬挂要与我方 DB（本地记录 + 原始素材 + 预览帧）联动，本轮不在这里做。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { AlertTriangle, CalendarClock, Coins, Mic2, UserSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipVendorApi } from "@/api";
import type { ClipVendorOverview, ClipVendorReconcile } from "@/api/clip-vendor";

function fmtNumber(n: number | null | undefined): string {
  return typeof n === "number" ? n.toLocaleString() : "—";
}

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function ClipVendorPage() {
  const [data, setData] = React.useState<ClipVendorOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setData(await ClipVendorApi.getVendorOverview());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const quota = data?.quota;
  const slotsExhausted = !!quota && !quota.error && (quota.avatarSlotsExhausted || quota.speakerSlotsExhausted);

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="石榴AI 供应商管理"
        description="数字人 / 声音克隆供应商的额度快照、对象清单，以及与我方 dap_avatar / dap_voice 的对账。只读视图，不提供删除。"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? "拉取中…" : "重新拉取"}
        </Button>
        {data && <span className="text-xs text-muted-foreground">拉取时间：{fmtTime(data.checkedAt)}（实时查询，无缓存）</span>}
      </div>

      {err && (
        <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {data?.mock && (
        <div className="rounded-md border border-warning/35 bg-warning/8 px-4 py-3 text-sm text-warning">
          当前走的是 <b>mock 网关</b>（本地 / 测试环境），下面的额度与清单<b>都是假数据</b>，不要当真账读。
        </div>
      )}

      {slotsExhausted && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/35 bg-destructive/8 px-4 py-3.5 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <div className="font-semibold">
              槽位已占满
              {quota?.avatarSlotsExhausted && quota?.speakerSlotsExhausted
                ? "：形象与音色都建不出新的了"
                : quota?.avatarSlotsExhausted
                  ? "：形象建不出新的了"
                  : "：音色建不出新的了"}
            </div>
            <p className="leading-6">
              availableAvatar / availableSpeaker 是「<b>可持有数量的剩余槽位</b>」而不是可创建次数 —— 归零意味着
              <b>必须先删掉不用的旧对象</b>才能再建，充点数没用（validPoint 还有 {fmtNumber(quota?.validPoint)}）。
              先看下面的「孤儿」清单：那些是石榴还留着、我方 DB 已经没有的对象，删掉最安全。
            </p>
          </div>
        </div>
      )}

      {/* ── 额度快照 ───────────────────────────────────────────────────────── */}
      {quota?.error ? (
        <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          额度读取失败：{quota.error}
          <span className="ml-1 opacity-80">（是「没读到」，不是「额度为 0」）</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="形象剩余槽位"
            value={fmtNumber(quota?.availableAvatar)}
            hint={quota?.avatarSlotsExhausted ? "已占满，需先删旧形象" : "availableAvatar"}
            icon={UserSquare}
            tone={quota?.avatarSlotsExhausted ? "danger" : "default"}
          />
          <StatCard
            label="音色剩余槽位"
            value={fmtNumber(quota?.availableSpeaker)}
            hint={quota?.speakerSlotsExhausted ? "已占满，需先删旧音色" : "availableSpeaker"}
            icon={Mic2}
            tone={quota?.speakerSlotsExhausted ? "danger" : "default"}
          />
          <StatCard
            label="通用点数"
            value={fmtNumber(quota?.validPoint)}
            hint="validPoint · TTS / 出片消耗"
            icon={Coins}
            tone={typeof quota?.validPoint === "number" && quota.validPoint < 500 ? "warning" : "default"}
          />
          <StatCard
            label="套餐有效期至"
            value={<span className="text-base">{quota?.validToTime ?? "—"}</span>}
            hint="validToTime · 上游原样返回"
            icon={CalendarClock}
          />
        </div>
      )}

      {/* ── 对账 ──────────────────────────────────────────────────────────── */}
      <ReconcileCard
        title="数字人形象对账"
        localTable="dap_avatar.engine_ref"
        vendorEndpoint="/avatar/list"
        data={data?.avatars}
        loading={loading}
      />
      <ReconcileCard
        title="音色对账"
        localTable="dap_voice.engine_ref"
        vendorEndpoint="/speaker/list"
        data={data?.voices}
        loading={loading}
      />
    </div>
  );
}

// ── 单侧对账卡片 ──────────────────────────────────────────────────────────────

function ReconcileCard({
  title,
  localTable,
  vendorEndpoint,
  data,
  loading,
}: {
  title: string;
  localTable: string;
  vendorEndpoint: string;
  data?: ClipVendorReconcile;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-xs text-muted-foreground">
          石榴 {vendorEndpoint} ↔ 我方 {localTable}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        {!data && loading && <div className="text-sm text-muted-foreground">加载中…</div>}
        {!data && !loading && <div className="text-sm text-muted-foreground">暂无数据。</div>}

        {/* 读失败必须与空态分开：读不到石榴侧时，本地全部记录会看着像「悬挂」，那是假警报。 */}
        {data?.error && (
          <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            <div className="font-medium">石榴侧清单读取失败：{data.error}</div>
            <p className="mt-1 leading-6 opacity-90">
              这不是「石榴侧没有对象」。本次<b>不做任何对账结论</b> —— 我方 DB 有 {data.localCount} 条 engine=shiliu 的记录，
              但在读到石榴清单之前，无法判断它们是正常还是悬挂。请重新拉取。
            </p>
          </div>
        )}

        {data && !data.error && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="neutral">石榴侧 {fmtNumber(data.vendorCount)} 个</Badge>
              <Badge tone="neutral">我方 {fmtNumber(data.localCount)} 条</Badge>
              <Badge tone="success">正常 {data.matched.length}</Badge>
              <Badge tone={data.orphan.length > 0 ? "warning" : "neutral"}>孤儿 {data.orphan.length}</Badge>
              <Badge tone={data.dangling.length > 0 ? "danger" : "neutral"}>悬挂 {data.dangling.length}</Badge>
              {data.unmatchable.length > 0 && <Badge tone="neutral">不参与对账 {data.unmatchable.length}</Badge>}
            </div>

            {/* 孤儿 —— 可操作：删掉能立刻腾出槽位 */}
            <Section
              heading="孤儿 · 石榴有、我方无"
              tone={data.orphan.length > 0 ? "warning" : "neutral"}
              note="我方 DB 里没有任何记录引用它们（含已软删但上游删除失败的残留）。白占槽位，可安全清理。"
              empty={data.orphan.length === 0 ? "没有孤儿对象。" : null}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>石榴对象 id</TableHead>
                    <TableHead>石榴侧标题</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orphan.map((row) => (
                    <TableRow key={row.engineRef}>
                      <TableCell className="font-mono text-xs tabular-nums">{row.engineRef}</TableCell>
                      <TableCell className="text-sm">{row.vendorTitle ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>

            {/* 悬挂 —— 可操作：用户点到会报错 */}
            <Section
              heading="悬挂 · 我方有、石榴无"
              tone={data.dangling.length > 0 ? "danger" : "neutral"}
              note="上游对象已被删除，本地没同步。这些记录用户点到会报错，需要人工确认后清理或重建。"
              empty={data.dangling.length === 0 ? "没有悬挂记录。" : null}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>我方 id</TableHead>
                    <TableHead>属主</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>engine_ref</TableHead>
                    <TableHead>本地状态</TableHead>
                    <TableHead>最后更新</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dangling.map((row) => (
                    <TableRow key={row.localId}>
                      <TableCell className="font-mono text-xs">{row.localId}</TableCell>
                      <TableCell className="font-mono text-xs">{row.ownerUserId}</TableCell>
                      <TableCell className="text-sm">{row.localName}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">{row.engineRef}</TableCell>
                      <TableCell className="text-sm">{row.engineStatus ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtTime(row.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>

            {/* 正常 —— 参考 */}
            <Section
              heading="正常 · 两边都有"
              tone="neutral"
              note="同一个石榴对象可被我方多行引用（一个音色可被多个形象复用），所以这里的条数按我方记录计。"
              empty={data.matched.length === 0 ? "没有已配对的对象。" : null}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>石榴对象 id</TableHead>
                    <TableHead>石榴侧标题</TableHead>
                    <TableHead>我方 id</TableHead>
                    <TableHead>属主</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>本地状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.matched.map((row) => (
                    <TableRow key={`${row.localId}:${row.engineRef}`}>
                      <TableCell className="font-mono text-xs tabular-nums">{row.engineRef}</TableCell>
                      <TableCell className="text-sm">{row.vendorTitle ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.localId}</TableCell>
                      <TableCell className="font-mono text-xs">{row.ownerUserId}</TableCell>
                      <TableCell className="text-sm">{row.localName}</TableCell>
                      <TableCell className="text-sm">{row.engineStatus ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>

            {/* 不参与对账 —— 解释「本地条数为什么对不上」，不是问题 */}
            {data.unmatchable.length > 0 && (
              <Section
                heading="不参与对账"
                tone="neutral"
                note="training = 还没拿到上游 id（训练中或训练失败）；mock = mock 时代残留的 ref，本来就没有上游对象。两类都不是悬挂。"
                empty={null}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>我方 id</TableHead>
                      <TableHead>属主</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>engine_ref</TableHead>
                      <TableHead>本地状态</TableHead>
                      <TableHead>原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.unmatchable.map((row) => (
                      <TableRow key={row.localId}>
                        <TableCell className="font-mono text-xs">{row.localId}</TableCell>
                        <TableCell className="font-mono text-xs">{row.ownerUserId}</TableCell>
                        <TableCell className="text-sm">{row.localName}</TableCell>
                        <TableCell className="font-mono text-xs">{row.engineRef ?? "—"}</TableCell>
                        <TableCell className="text-sm">{row.engineStatus ?? "—"}</TableCell>
                        <TableCell>
                          <Badge tone="neutral">{row.reason === "mock" ? "mock 残留" : "训练中"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  heading,
  tone,
  note,
  empty,
  children,
}: {
  heading: string;
  tone: "neutral" | "warning" | "danger";
  note: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {tone === "neutral" ? (
          <span className="text-sm font-medium">{heading}</span>
        ) : (
          <Badge tone={tone}>
            <AlertTriangle className="h-3 w-3" />
            {heading}
          </Badge>
        )}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{note}</p>
      {empty ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}
