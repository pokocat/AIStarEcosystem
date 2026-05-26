"use client";

import * as React from "react";
import { Megaphone, Search, Flame, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CelebrityZoneApi } from "@/api";
import type { CelebrityCategory, CelebrityStar } from "@/types/celebrity-zone";

const CATEGORIES: CelebrityCategory[] = ["演员", "歌手", "主持人", "运动员", "网红", "综艺"];

const AUTH_LABEL: Record<string, string> = {
  authorized: "已授权",
  pending: "审核中",
  expired: "已过期",
  unauthorized: "未授权",
};

const AUTH_TONE: Record<string, string> = {
  authorized: "border-emerald-300 bg-emerald-50 text-emerald-700",
  pending: "border-amber-300 bg-amber-50 text-amber-700",
  expired: "border-rose-300 bg-rose-50 text-rose-700",
  unauthorized: "border-slate-300 bg-slate-50 text-slate-600",
};

export default function AdminCelebrityStarsPage() {
  const [stars, setStars] = React.useState<CelebrityStar[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<CelebrityCategory | "all">("all");

  const [editing, setEditing] = React.useState<CelebrityStar | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<CelebrityStar | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await CelebrityZoneApi.listStars({
        category: category === "all" ? "全部" : category,
        sort: "hot",
      });
      setStars(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [category]);

  React.useEffect(() => { void reload(); }, [reload]);

  const filtered = stars.filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase())
  );

  const hotCount = stars.filter((s) => s.isHot).length;
  const authorizedCount = stars.filter((s) => s.authorization.status === "authorized").length;
  const totalGenerated = stars.reduce((sum, s) => sum + (s.stats.totalGenerated || 0), 0);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setActionError(null);
    try {
      await CelebrityZoneApi.deleteStar(pendingDelete.id);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="明星档案"
        description="AI 明星专区市场可见的明星形象（来自 /admin/celebrity/stars）·授权状态 / 套餐用量 / 引用统计"
        breadcrumb={[{ label: "明星带货" }, { label: "明星档案" }]}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />新增明星
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="明星总数" value={stars.length} icon={Megaphone} />
        <StatCard label="热门" value={hotCount} icon={Flame} tone="warning" />
        <StatCard label="已授权" value={authorizedCount} icon={Megaphone} tone="success" />
        <StatCard label="累计生成视频" value={totalGenerated} icon={Megaphone} hint="所有明星累计 totalGenerated" />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">明星清单</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按明星名搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as CelebrityCategory | "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
              加载失败：{loadError}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>明星</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>授权</TableHead>
                <TableHead>套餐</TableHead>
                <TableHead className="text-right">配额</TableHead>
                <TableHead className="text-right">已生成</TableHead>
                <TableHead>累计播放</TableHead>
                <TableHead>GMV</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <img src={s.avatar} alt={s.name} className="h-9 w-9 rounded-full object-cover border" />
                      <div className="flex flex-col">
                        <span className="font-medium">{s.name} {s.isHot && <span className="text-amber-500">🔥</span>}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">{s.description}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><span className="rounded-md border px-2 py-0.5 text-xs">{s.category}</span></TableCell>
                  <TableCell>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${AUTH_TONE[s.authorization.status] ?? AUTH_TONE.unauthorized}`}>
                      {AUTH_LABEL[s.authorization.status] ?? s.authorization.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.pricingTier ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {(s.quotaUsed ?? 0)} / {(s.quotaTotal ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.stats.totalGenerated}</TableCell>
                  <TableCell className="text-sm">{s.stats.totalPlays}</TableCell>
                  <TableCell className="text-sm">{s.stats.gmv}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDelete(s)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">没有匹配的明星</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <StarFormDialog
          star={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }}
        />
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) { setPendingDelete(null); setActionError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除明星</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            确认删除明星「<strong>{pendingDelete?.name}</strong>」？
          </p>
          <p className="text-xs text-muted-foreground">删除后该明星不再出现在用户端列表，但历史已生成的视频与项目不受影响。该操作不可撤销。</p>
          {actionError && <p className="text-sm text-rose-600">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>取消</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 表单 dialog（新建 / 编辑共用） ────────────────────────────────────────────
function StarFormDialog({
  star,
  onClose,
  onSaved,
}: {
  star: CelebrityStar | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!star;
  const [name, setName] = React.useState(star?.name ?? "");
  const [category, setCategory] = React.useState<CelebrityCategory>(star?.category ?? "演员");
  const [avatar, setAvatar] = React.useState(star?.avatar ?? "");
  const [cover, setCover] = React.useState(star?.cover ?? "");
  const [description, setDescription] = React.useState(star?.description ?? "");
  const [pricingTier, setPricingTier] = React.useState<string>(star?.pricingTier ?? "标准版");
  const [startingPrice, setStartingPrice] = React.useState(star?.startingPrice ?? "¥99起");
  const [isHot, setIsHot] = React.useState(star?.isHot ?? false);
  const [quotaTotal, setQuotaTotal] = React.useState<number>(star?.quotaTotal ?? 100);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("明星名称必填"); return; }
    if (!avatar.trim()) { setError("头像 URL 必填"); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        category,
        avatar: avatar.trim(),
        cover: cover.trim() || undefined,
        description: description.trim() || undefined,
        pricingTier,
        startingPrice,
        isHot,
        quotaTotal,
      } as Partial<CelebrityStar>;
      if (isEdit && star) {
        await CelebrityZoneApi.updateStar(star.id, body);
      } else {
        await CelebrityZoneApi.createStar(body);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `编辑明星：${star?.name}` : "新增明星"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="明星名称">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 Alice 张" required />
            </Field>
            <Field label="分类">
              <Select value={category} onValueChange={(v) => setCategory(v as CelebrityCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="头像 URL">
              <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." required />
            </Field>
            <Field label="封面 URL">
              <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="套餐档位">
              <Select value={pricingTier} onValueChange={(v) => setPricingTier(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="体验版">体验版</SelectItem>
                  <SelectItem value="标准版">标准版</SelectItem>
                  <SelectItem value="旗舰版">旗舰版</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="起步价">
              <Input value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} placeholder="如 ¥99起" />
            </Field>
            <Field label="配额上限">
              <Input
                type="number"
                value={quotaTotal}
                onChange={(e) => setQuotaTotal(parseInt(e.target.value, 10) || 0)}
                min={0}
              />
            </Field>
            <Field label="热门标记">
              <div className="flex items-center h-10">
                <Switch checked={isHot} onCheckedChange={setIsHot} />
                <span className="ml-2 text-sm text-muted-foreground">{isHot ? "🔥 显示热门" : "不显示"}</span>
              </div>
            </Field>
          </div>
          <Field label="简介">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
