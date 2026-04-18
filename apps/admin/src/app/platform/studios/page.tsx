"use client";

import * as React from "react";
import { Building2, Sparkles, Music2, Coins, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listStudios, setStudioStatus } from "@/api/studios";
import { listUsers } from "@/api/users";
import { STUDIO_KIND, STUDIO_STATUS } from "@/constants/status";
import type { AdminStudio, StudioKind } from "@/types/studio";
import type { AepUser } from "@/types/account";
import { formatCredits } from "@/lib/format";

export default function StudiosPage() {
  const [studios, setStudios] = React.useState<AdminStudio[]>([]);
  const [accounts, setAccounts] = React.useState<AepUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<"all" | StudioKind>("all");
  const [target, setTarget] = React.useState<{ studio: AdminStudio; action: "suspend" | "reactivate" } | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, u] = await Promise.all([
        listStudios(0, 200),
        listUsers(0, 200),
      ]);
      setStudios(s);
      setAccounts(u);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const userById = React.useMemo(() => new Map(accounts.map((u) => [u.id, u])), [accounts]);

  const filtered = studios.filter((s) => {
    if (kind !== "all" && s.kind !== kind) return false;
    if (query && !s.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const counts = {
    total: studios.length,
    artists: studios.reduce((sum, s) => sum + s.artistCount, 0),
    songs: studios.reduce((sum, s) => sum + s.songCount, 0),
    revenueCredits: studios.reduce((sum, s) => sum + s.totalRevenueCredits, 0),
  };

  async function handleConfirm() {
    if (!target) return;
    const nextStatus = target.action === "suspend" ? "suspended" : "active";
    await setStudioStatus(target.studio.id, nextStatus);
    setTarget(null);
    await reload();
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="经纪公司 / 工作室"
        description="Studio：业务主体档案与聚合指标（来自后端 /admin/studios）。每个 Studio 1:1 关联一个 AepUser。"
        breadcrumb={[{ label: "平台账户" }, { label: "经纪公司 / 工作室" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="主体总数"       value={counts.total}                    icon={Building2} />
        <StatCard label="名下艺人"       value={counts.artists}                  icon={Sparkles}  tone="default" />
        <StatCard label="作品总数"       value={counts.songs}                    icon={Music2}    />
        <StatCard label="累计收益（积分）" value={formatCredits(counts.revenueCredits)} icon={Coins} tone="success" />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>主体列表</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 w-[200px]" placeholder="主体名称" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <Select value={kind} onValueChange={(v) => setKind(v as "all" | StudioKind)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="主体类型" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="mcn">MCN 机构</SelectItem>
                  <SelectItem value="agency">经纪公司</SelectItem>
                  <SelectItem value="music_studio">音乐工作室</SelectItem>
                  <SelectItem value="drama_studio">短剧工作室</SelectItem>
                  <SelectItem value="variety_studio">综艺工作室</SelectItem>
                  <SelectItem value="personal_creator">个人创作者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">主体</TableHead>
                <TableHead className="min-w-[120px]">类型</TableHead>
                <TableHead className="min-w-[140px]">所属账号</TableHead>
                <TableHead className="text-right">名下艺人</TableHead>
                <TableHead className="text-right">作品</TableHead>
                <TableHead className="text-right">月度收益</TableHead>
                <TableHead className="text-right">累计收益</TableHead>
                <TableHead className="min-w-[96px]">状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && loadError && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-rose-600">
                    加载失败：{loadError}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.map((s) => {
                const owner = userById.get(s.ownerUserId);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{s.name}</span>
                        {s.bio && <span className="text-xs text-muted-foreground truncate max-w-[280px]">{s.bio}</span>}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge meta={STUDIO_KIND[s.kind]} /></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{owner ? `@${owner.username}` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.artistCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.songCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCredits(s.monthlyRevenueCredits)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCredits(s.totalRevenueCredits)}</TableCell>
                    <TableCell><StatusBadge meta={STUDIO_STATUS[s.status]} /></TableCell>
                    <TableCell className="text-right">
                      {s.status === "active" ? (
                        <Button size="sm" variant="destructive" onClick={() => setTarget({ studio: s, action: "suspend" })}>
                          暂停
                        </Button>
                      ) : s.status === "suspended" ? (
                        <Button size="sm" variant="success" onClick={() => setTarget({ studio: s, action: "reactivate" })}>
                          恢复
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost">查看</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    没有匹配的主体
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.action === "suspend" ? `暂停主体：${target.studio.name}` : `恢复主体：${target.studio.name}`}
          description={`${STUDIO_KIND[target.studio.kind]?.label} · 名下 ${target.studio.artistCount} 位艺人`}
          tone={target.action === "suspend" ? "danger" : "success"}
          confirmLabel={target.action === "suspend" ? "暂停" : "恢复"}
          requireReason
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
