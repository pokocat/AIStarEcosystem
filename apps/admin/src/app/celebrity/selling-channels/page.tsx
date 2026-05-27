"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
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
import { SellingChannelsApi } from "@/api";
import type { SellingChannel, SellingChannelStatus, SellingChannelType } from "@/types/selling-channel";
import { SELLING_CHANNEL_TYPE_LABEL } from "@/types/selling-channel";

const TYPES: SellingChannelType[] = ["direct", "agent", "online_store", "event", "partner"];

const STATUS_TONE: Record<SellingChannelStatus, string> = {
  active: "border-emerald-300 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-300 bg-slate-50 text-slate-600",
};

export default function SellingChannelsPage() {
  const [list, setList] = React.useState<SellingChannel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<SellingChannel | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<SellingChannel | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      setList(await SellingChannelsApi.listChannels());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  const activeCount = list.filter((c) => c.status === "active").length;
  const inactiveCount = list.filter((c) => c.status === "inactive").length;

  async function confirmDelete() {
    if (!pendingDelete) return;
    setActionError(null);
    try {
      await SellingChannelsApi.deleteChannel(pendingDelete.id);
      setPendingDelete(null);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "停用失败");
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="销售渠道"
        description="激活码批次的「销售来源 / 售卖主体」。内部可见，用于财务对账与运营统计；与 MCN 机构无关。"
        breadcrumb={[{ label: "平台账户" }, { label: "销售渠道" }]}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />新增渠道
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="渠道总数" value={list.length} icon={Building2} />
        <StatCard label="生效中" value={activeCount} icon={Building2} tone="success" />
        <StatCard label="已停用" value={inactiveCount} icon={Building2} hint="软删保留历史 batch 引用" />
      </section>

      <Card>
        <CardHeader><CardTitle>渠道清单</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
              加载失败：{loadError}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>code</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>售卖主体</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && list.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.sellingEntity ?? "—"}</TableCell>
                  <TableCell><span className="rounded-md border px-2 py-0.5 text-xs">{SELLING_CHANNEL_TYPE_LABEL[c.type]}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[c.contactEmail, c.contactPhone].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_TONE[c.status]}`}>
                      {c.status === "active" ? "生效" : "已停用"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {c.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => setPendingDelete(c)}>
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    暂无渠道。点「新增渠道」创建第一条（推荐：平台直营 / 外部代销）。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <ChannelFormDialog
          channel={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }}
        />
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) { setPendingDelete(null); setActionError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>停用渠道</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            确认停用渠道「<strong>{pendingDelete?.name}</strong>」？
          </p>
          <p className="text-xs text-muted-foreground">
            采用软删 —— 渠道状态改为 inactive 但不物理删除，已绑定该渠道的历史批次仍可正常激活；
            新建批次将不再出现此选项。
          </p>
          {actionError && <p className="text-sm text-rose-600">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>取消</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>确认停用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChannelFormDialog({
  channel,
  onClose,
  onSaved,
}: {
  channel: SellingChannel | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!channel;
  const [code, setCode] = React.useState(channel?.code ?? "");
  const [name, setName] = React.useState(channel?.name ?? "");
  const [sellingEntity, setSellingEntity] = React.useState(channel?.sellingEntity ?? "");
  const [type, setType] = React.useState<SellingChannelType>(channel?.type ?? "direct");
  const [contactEmail, setContactEmail] = React.useState(channel?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = React.useState(channel?.contactPhone ?? "");
  const [remark, setRemark] = React.useState(channel?.remark ?? "");
  const [active, setActive] = React.useState(channel?.status !== "inactive");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !code.trim()) { setError("code 必填"); return; }
    if (!name.trim()) { setError("名称必填"); return; }
    setSaving(true);
    try {
      const body = {
        ...(isEdit ? {} : { code: code.trim() }),
        name: name.trim(),
        sellingEntity: sellingEntity.trim() || undefined,
        type,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        remark: remark.trim() || undefined,
        status: (active ? "active" : "inactive") as SellingChannelStatus,
      };
      if (isEdit && channel) {
        await SellingChannelsApi.updateChannel(channel.id, body);
      } else {
        await SellingChannelsApi.createChannel(body);
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `编辑渠道：${channel?.name}` : "新增销售渠道"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="code（唯一，建议英文短词）">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="如 platform-self / agent-xingmeng" disabled={isEdit} required={!isEdit} />
            </Field>
            <Field label="名称（内部显示）">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 平台直营" required />
            </Field>
            <Field label="售卖主体">
              <Input value={sellingEntity} onChange={(e) => setSellingEntity(e.target.value)} placeholder="如 星梦娱乐 / AI Star Eco" />
            </Field>
            <Field label="渠道类型">
              <Select value={type} onValueChange={(v) => setType(v as SellingChannelType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{SELLING_CHANNEL_TYPE_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="联系邮箱">
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" />
            </Field>
            <Field label="联系电话">
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </Field>
            <Field label="状态">
              <div className="flex items-center h-10">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="ml-2 text-sm text-muted-foreground">{active ? "生效中" : "已停用"}</span>
              </div>
            </Field>
          </div>
          <Field label="备注（内部）">
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} />
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
