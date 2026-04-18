"use client";

import * as React from "react";
import Image from "next/image";
import { PersonStanding, Smile, Hand, Plus, Lock, Sparkles, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { POSE_DIFFICULTY } from "@/constants/status";
import { POSE_DATABASE, EXPRESSION_DATABASE, GESTURE_DATABASE } from "@/mocks/pose";
import type { PoseCategory, Pose, Expression, Gesture, SaleStatus } from "@/types/pose";
import { PoseApi, StoreApi } from "@/api";

const POSE_CAT_LABEL: Record<PoseCategory, string> = {
  standing: "站姿",
  sitting: "坐姿",
  dancing: "舞蹈",
  singing: "演唱",
  action: "动作",
};

const POSE_CATS: PoseCategory[] = ["standing", "sitting", "dancing", "singing", "action"];

const SALE_LABEL: Record<SaleStatus, string> = { FREE: "免费", PAID: "付费", LOCKED: "未上架" };
const SALE_TONE: Record<SaleStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  FREE: "info", PAID: "success", LOCKED: "neutral",
};

type EditTarget =
  | { type: "POSE"; item: Pose }
  | { type: "EXPRESSION"; item: Expression }
  | { type: "GESTURE"; item: Gesture };

export default function PosePage() {
  const [poseCat, setPoseCat] = React.useState<PoseCategory | "all">("all");
  const [poses, setPoses] = React.useState<Pose[]>(POSE_DATABASE);
  const [expressions, setExpressions] = React.useState<Expression[]>(EXPRESSION_DATABASE);
  const [gestures, setGestures] = React.useState<Gesture[]>(GESTURE_DATABASE);

  const [editing, setEditing] = React.useState<EditTarget | null>(null);
  const [editPrice, setEditPrice] = React.useState<string>("0");
  const [editStatus, setEditStatus] = React.useState<SaleStatus>("FREE");
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: "ok" | "err"; msg: string } | null>(null);

  React.useEffect(() => {
    Promise.all([
      PoseApi.listPoses().catch(() => [] as Pose[]),
      PoseApi.listExpressions().catch(() => [] as Expression[]),
      PoseApi.listGestures().catch(() => [] as Gesture[]),
    ]).then(([p, e, g]) => {
      if (p.length > 0) setPoses(p);
      if (e.length > 0) setExpressions(e);
      if (g.length > 0) setGestures(g);
    });
  }, []);

  const poseList = poses.filter((p) => poseCat === "all" || p.category === poseCat);
  const locked = poses.filter((p) => p.isLocked || p.saleStatus === "LOCKED").length;
  const newPoses = poses.filter((p) => p.isNew).length;

  const openEdit = (t: EditTarget) => {
    setEditing(t);
    setEditPrice(String(t.item.priceCredits ?? 0));
    setEditStatus(t.item.saleStatus ?? "FREE");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price < 0) {
      setToast({ type: "err", msg: "价格必须是非负整数" });
      return;
    }
    setSaving(true);
    try {
      await StoreApi.updatePricing(editing.type, editing.item.id, {
        priceCredits: price,
        saleStatus: editStatus,
      });
      const patch = { priceCredits: price, saleStatus: editStatus };
      if (editing.type === "POSE") {
        setPoses((prev) => prev.map((it) => it.id === editing.item.id ? { ...it, ...patch } : it));
      } else if (editing.type === "EXPRESSION") {
        setExpressions((prev) => prev.map((it) => it.id === editing.item.id ? { ...it, ...patch } : it));
      } else {
        setGestures((prev) => prev.map((it) => it.id === editing.item.id ? { ...it, ...patch } : it));
      }
      setToast({ type: "ok", msg: `已更新：${editing.item.name}` });
      setEditing(null);
    } catch (e: any) {
      setToast({ type: "err", msg: typeof e?.message === "string" ? e.message : "保存失败" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const saleBadge = (status: SaleStatus | undefined, price: number | undefined) => {
    const s = status ?? "FREE";
    return (
      <Badge tone={SALE_TONE[s]}>
        {s === "PAID" ? `${price ?? 0}⭐` : SALE_LABEL[s]}
      </Badge>
    );
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="动作 / 表情 / 手势库"
        description="艺人表演素材库：姿态、表情、手势三大维度（支持积分定价）"
        breadcrumb={[{ label: "运营基础数据" }, { label: "动作与表情" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 新增素材
          </Button>
        }
      />

      {toast && (
        <div className={`mb-4 rounded-md px-3 py-2 text-sm ${toast.type === "ok"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
          {toast.msg}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="姿态总数" value={poses.length} icon={PersonStanding} />
        <StatCard label="表情总数" value={expressions.length} icon={Smile} />
        <StatCard label="手势总数" value={gestures.length} icon={Hand} />
        <StatCard label="未上架素材" value={locked} hint={`新品 ${newPoses}`} icon={Lock} />
      </section>

      <Tabs defaultValue="poses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="poses">姿态 ({poses.length})</TabsTrigger>
          <TabsTrigger value="expressions">表情 ({expressions.length})</TabsTrigger>
          <TabsTrigger value="gestures">手势 ({gestures.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="poses">
          <Card>
            <CardHeader><CardTitle>姿态库</CardTitle></CardHeader>
            <CardContent>
              <Tabs value={poseCat} onValueChange={(v) => setPoseCat(v as PoseCategory | "all")}>
                <TabsList>
                  <TabsTrigger value="all">全部</TabsTrigger>
                  {POSE_CATS.map((c) => (
                    <TabsTrigger key={c} value={c}>{POSE_CAT_LABEL[c]}</TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={poseCat}>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {poseList.map((p) => (
                      <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
                        <div className="aspect-square relative bg-surface-muted">
                          {p.thumbnail
                            ? <Image src={p.thumbnail} alt={p.name} fill sizes="200px" className="object-cover" />
                            : <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">无预览</div>}
                          <div className="absolute top-1.5 left-1.5 flex gap-1">
                            {p.isNew && <Badge tone="success"><Sparkles className="h-3 w-3" /> 新</Badge>}
                            {saleBadge(p.saleStatus, p.priceCredits)}
                          </div>
                          <div className="absolute top-1.5 right-1.5">
                            <StatusBadge meta={POSE_DIFFICULTY[p.difficulty]} />
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{POSE_CAT_LABEL[p.category]}</div>
                          <div className="flex items-center justify-end mt-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                                    onClick={() => openEdit({ type: "POSE", item: p })}>
                              <Pencil className="h-3 w-3 mr-1" /> 定价
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expressions">
          <Card>
            <CardHeader><CardTitle>表情库</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {expressions.map((e) => (
                  <div key={e.id} className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 card-shadow">
                    <div className="text-4xl">{e.emoji}</div>
                    <div className="font-medium text-sm">{e.name}</div>
                    <div className="w-full">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>强度</span>
                        <span className="tabular-nums">{e.intensity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${e.intensity}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{e.category}</Badge>
                      {saleBadge(e.saleStatus, e.priceCredits)}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => openEdit({ type: "EXPRESSION", item: e })}>
                      <Pencil className="h-3 w-3 mr-1" /> 定价
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gestures">
          <Card>
            <CardHeader><CardTitle>手势库</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {gestures.map((g) => (
                  <div key={g.id} className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 card-shadow">
                    <div className="text-4xl">{g.icon}</div>
                    <div className="font-medium text-sm">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.category}</div>
                    {saleBadge(g.saleStatus, g.priceCredits)}
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => openEdit({ type: "GESTURE", item: g })}>
                      <Pencil className="h-3 w-3 mr-1" /> 定价
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>定价：{editing?.item.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-muted-foreground">销售状态</label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as SaleStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">免费</SelectItem>
                  <SelectItem value="PAID">付费</SelectItem>
                  <SelectItem value="LOCKED">未上架</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">积分价格</label>
              <Input
                type="number"
                min={0}
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                disabled={editStatus !== "PAID"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>取消</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
