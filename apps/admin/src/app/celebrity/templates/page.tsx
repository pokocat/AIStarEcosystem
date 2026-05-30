"use client";

import * as React from "react";
import { Sparkles, Plus, Pencil, Trash2, Search, Flame } from "lucide-react";
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
import type { CelebrityEngine, CelebrityTemplate, CelebrityVideoDuration, EnginePriceLevel, TemplateStyle } from "@/types/celebrity-zone";

const STYLES: TemplateStyle[] = ["种草安利", "硬核测评", "轻松开箱", "直播切片", "剧情植入"];
const ENGINES: CelebrityEngine[] = ["KeLing", "HiGen", "MiniMax"];
const PRICE_LEVELS: EnginePriceLevel[] = ["经济", "标准", "高级"];
const DURATIONS: CelebrityVideoDuration[] = [15, 30, 60];

export default function AdminCelebrityTemplatesPage() {
  const [list, setList] = React.useState<CelebrityTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<"all" | "factory" | "user">("all");

  const [editing, setEditing] = React.useState<CelebrityTemplate | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<CelebrityTemplate | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await CelebrityZoneApi.listTemplates();
      setList(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void reload(); }, [reload]);

  const filtered = list.filter((t) => {
    if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (scopeFilter === "factory" && !t.isFactory) return false;
    if (scopeFilter === "user" && t.isFactory) return false;
    return true;
  });

  const factoryCount = list.filter((t) => t.isFactory).length;
  const userCount = list.filter((t) => !t.isFactory).length;
  const hotCount = list.filter((t) => t.isHot).length;

  async function confirmDelete() {
    if (!pendingDelete) return;
    setActionError(null);
    try {
      await CelebrityZoneApi.deleteTemplate(pendingDelete.id);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="明星视频模板"
        description="数字人 / 明星视频生成模板。工厂模板对所有用户可见，用户私有模板仅本人可见。"
        breadcrumb={[{ label: "明星带货" }, { label: "模板" }]}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />新增工厂模板
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="模板总数" value={list.length} icon={Sparkles} />
        <StatCard label="工厂模板" value={factoryCount} icon={Sparkles} tone="success" hint="所有用户可见" />
        <StatCard label="用户私有" value={userCount} icon={Sparkles} hint="仅 owner 可见" />
        <StatCard label="热门" value={hotCount} icon={Flame} tone="warning" />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">模板清单</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按模板名搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as "all" | "factory" | "user")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="factory">工厂模板</SelectItem>
              <SelectItem value="user">用户私有</SelectItem>
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
                <TableHead>模板</TableHead>
                <TableHead>风格</TableHead>
                <TableHead>归属</TableHead>
                <TableHead>引擎</TableHead>
                <TableHead>档位</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>播放</TableHead>
                <TableHead>转化率</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{t.name} {t.isHot && <span className="text-amber-500">🔥</span>}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1 max-w-[320px]">{t.description}</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="rounded-md border px-2 py-0.5 text-xs">{t.style}</span></TableCell>
                  <TableCell>
                    {t.isFactory ? (
                      <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">工厂</span>
                    ) : (
                      <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-600" title={t.ownerUserId ?? "private"}>
                        私有 {t.ownerUserId ? `· ${t.ownerUserId.slice(0, 8)}` : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{t.recommendedEngine}</TableCell>
                  <TableCell className="text-sm">{t.recommendedPrice}</TableCell>
                  <TableCell className="text-sm">{t.durationSec ? `${t.durationSec}s` : "—"}</TableCell>
                  <TableCell className="text-sm">{t.plays}</TableCell>
                  <TableCell className="text-sm">{t.conversionRate}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDelete(t)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">没有匹配的模板</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <TemplateFormDialog
          template={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }}
        />
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) { setPendingDelete(null); setActionError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除模板</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            确认删除模板「<strong>{pendingDelete?.name}</strong>」？
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingDelete?.isFactory ? "工厂模板删除后所有用户将无法再选用此模板。" : "用户私有模板删除后仅影响该 owner。"}
            该操作不可撤销。
          </p>
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

// ── 表单 dialog ───────────────────────────────────────────────────────────────
function TemplateFormDialog({
  template,
  onClose,
  onSaved,
}: {
  template: CelebrityTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!template;
  const [name, setName] = React.useState(template?.name ?? "");
  const [style, setStyle] = React.useState<TemplateStyle>(template?.style ?? "种草安利");
  const [description, setDescription] = React.useState(template?.description ?? "");
  const [engine, setEngine] = React.useState<CelebrityEngine>(template?.recommendedEngine ?? "HiGen");
  const [priceLevel, setPriceLevel] = React.useState<EnginePriceLevel>(template?.recommendedPrice ?? "标准");
  const [isHot, setIsHot] = React.useState(template?.isHot ?? false);
  const [plays, setPlays] = React.useState(template?.plays ?? "—");
  const [conversionRate, setConversionRate] = React.useState(template?.conversionRate ?? "—");
  const [fitHint, setFitHint] = React.useState(template?.fitHint ?? "");
  const [durationSec, setDurationSec] = React.useState<CelebrityVideoDuration>(template?.durationSec ?? 30);
  const [previewCover, setPreviewCover] = React.useState(template?.previewCover ?? "");
  const [previewVideoUrl, setPreviewVideoUrl] = React.useState(template?.previewVideoUrl ?? "");
  const [isFactory, setIsFactory] = React.useState(template?.isFactory ?? true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("模板名称必填"); return; }
    // v0.34+：admin 后台暂不提供「指定用户私有模板的 owner」选择 UI。
    // 新建私有模板时如果没有 owner，会变成孤儿行（无用户能看到），所以阻塞。
    if (!isFactory && !isEdit) {
      setError("新建私有模板需通过用户端「保存为我的模板」入口创建；admin 后台仅支持新建工厂模板。");
      return;
    }
    setSaving(true);
    try {
      const body: Partial<CelebrityTemplate> = {
        name: name.trim(),
        style,
        description: description.trim(),
        recommendedEngine: engine,
        recommendedPrice: priceLevel,
        isHot,
        plays: plays || "—",
        conversionRate: conversionRate || "—",
        fitHint: fitHint || undefined,
        durationSec,
        previewCover: previewCover || undefined,
        previewVideoUrl: previewVideoUrl || undefined,
        isFactory,
        // v0.34+ 修复：私有模板 admin 端目前没有 owner 选择 UI；阻塞「未选 owner 又勾私有」生成孤儿行。
        // factory: ownerScope='factory' / ownerUserId 不传
        // private (编辑): 保留原 ownerScope + ownerUserId
        // private (新建): 不允许（在 handleSubmit 前已校验）
        ownerScope: isFactory ? "factory" : (template?.ownerScope ?? "factory"),
        ownerUserId: isFactory ? null : (template?.ownerUserId ?? undefined),
      };
      if (isEdit && template) {
        await CelebrityZoneApi.updateTemplate(template.id, body);
      } else {
        await CelebrityZoneApi.createTemplate(body);
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `编辑模板：${template?.name}` : "新增工厂模板"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="模板名称">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 种草标准版" required />
            </Field>
            <Field label="风格">
              <Select value={style} onValueChange={(v) => setStyle(v as TemplateStyle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="推荐引擎">
              <Select value={engine} onValueChange={(v) => setEngine(v as CelebrityEngine)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENGINES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="档位">
              <Select value={priceLevel} onValueChange={(v) => setPriceLevel(v as EnginePriceLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="推荐时长">
              <Select value={String(durationSec)} onValueChange={(v) => setDurationSec(parseInt(v, 10) as CelebrityVideoDuration)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} 秒</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="模板归属">
              <div className="flex items-center h-10 gap-3">
                <Switch checked={isFactory} onCheckedChange={setIsFactory} />
                <span className="text-sm text-muted-foreground">
                  {isFactory ? "🏭 工厂模板（所有用户可见）" : "👤 用户私有"}
                </span>
              </div>
            </Field>
            <Field label="累计播放">
              <Input value={plays} onChange={(e) => setPlays(e.target.value)} placeholder="如 12.3M" />
            </Field>
            <Field label="转化率">
              <Input value={conversionRate} onChange={(e) => setConversionRate(e.target.value)} placeholder="如 8.5%" />
            </Field>
            <Field label="预览封面">
              <ImageField value={previewCover} onChange={setPreviewCover} kind="preview" placeholder="贴 URL 或点「上传」" />
            </Field>
            <Field label="预览视频 URL">
              <Input value={previewVideoUrl} onChange={(e) => setPreviewVideoUrl(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="热门标记">
              <div className="flex items-center h-10">
                <Switch checked={isHot} onCheckedChange={setIsHot} />
                <span className="ml-2 text-sm text-muted-foreground">{isHot ? "🔥 显示热门" : "不显示"}</span>
              </div>
            </Field>
          </div>
          <Field label="模板描述">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="适配度提示">
            <Textarea value={fitHint} onChange={(e) => setFitHint(e.target.value)} rows={2} placeholder="如 口型匹配 95%+，适合年轻群体" />
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

function ImageField({
  value,
  onChange,
  kind,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  kind: "avatar" | "cover" | "preview" | "photo";
  placeholder?: string;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true); setError(null);
    try {
      const res = await CelebrityZoneApi.uploadCelebrityImage(file, kind);
      onChange(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading}
          onClick={() => fileInputRef.current?.click()}>
          {uploading ? "上传中…" : "上传"}
        </Button>
      </div>
      {value && (
        <img src={value} alt="" className="h-16 w-16 rounded object-cover border"
          onError={(e) => (e.currentTarget.style.display = "none")} />
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
