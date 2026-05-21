"use client";

import * as React from "react";
import { Sparkles, Search, Trash2, Upload, Pencil, Save, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MixcutOfficialClipsApi } from "@/api";
import type { OfficialClip } from "@/api/mixcut-official-clips";
import { formatDateCN } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/format";

// v0.21+：「官方明星片段」管理页。
// 由平台运营整理上传，用户在 web-celebrity 的「我的混剪库 > 官方明星片段」tab 只读消费。
const PRESET_CATEGORIES = ["直播切片", "综艺", "访谈", "短视频", "Vlog"];

export default function AdminMixcutOfficialClipsPage() {
  const [clips, setClips] = React.useState<OfficialClip[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");

  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await MixcutOfficialClipsApi.listOfficialClips({
        category: category === "all" ? undefined : category,
      });
      setClips(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [category]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = clips.filter((c) => {
    if (!q.trim()) return true;
    const ql = q.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(ql) ||
      (c.tags ?? "").toLowerCase().includes(ql) ||
      (c.related_star_id ?? "").toLowerCase().includes(ql)
    );
  });

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该官方片段？删除后用户端立即不可见，文件一并清除。")) return;
    try {
      await MixcutOfficialClipsApi.deleteOfficialClip(id);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const categories = (() => {
    const set = new Set<string>(PRESET_CATEGORIES);
    for (const c of clips) {
      if (c.official_category) set.add(c.official_category);
    }
    return Array.from(set);
  })();

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="官方明星片段"
        description="平台运营整理上传的明星直播切片 / 综艺 / 访谈片段。用户在「我的混剪库」可只读消费，用作混剪素材。"
        breadcrumb={[{ label: "明星带货" }, { label: "官方明星片段" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="片段总数" value={clips.length} icon={Sparkles} />
        <StatCard
          label="分类数"
          value={categories.length}
          icon={Sparkles}
        />
        <StatCard
          label="累计大小"
          value={formatCompactNumber(
            clips.reduce((s, c) => s + (c.file_size ?? 0), 0),
          )}
          hint="字节数累计"
          icon={Sparkles}
        />
        <StatCard
          label="带明星标签"
          value={clips.filter((c) => c.related_star_id).length}
          icon={Sparkles}
          tone="success"
        />
      </section>

      <Card className="mb-6">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">片段列表</CardTitle>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" /> 上传新片段
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索名称 / 标签 / 明星 ID…"
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500 mb-3">
              {loadError}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">名称</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>关联明星</TableHead>
                <TableHead>标签</TableHead>
                <TableHead>上传时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    没有匹配的片段
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <ClipRow
                    key={c.id}
                    clip={c}
                    isEditing={editingId === c.id}
                    onEditToggle={(on) => setEditingId(on ? c.id : null)}
                    onChanged={reload}
                    onDelete={() => handleDelete(c.id)}
                    categoryOptions={categories}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {uploadOpen && (
        <UploadDialog
          categories={categories}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function ClipRow({
  clip,
  isEditing,
  onEditToggle,
  onChanged,
  onDelete,
  categoryOptions,
}: {
  clip: OfficialClip;
  isEditing: boolean;
  onEditToggle: (on: boolean) => void;
  onChanged: () => void;
  onDelete: () => void;
  categoryOptions: string[];
}) {
  const [name, setName] = React.useState(clip.name);
  const [category, setCategory] = React.useState(clip.official_category ?? "");
  const [starId, setStarId] = React.useState(clip.related_star_id ?? "");
  const [tags, setTags] = React.useState(clip.tags ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setName(clip.name);
      setCategory(clip.official_category ?? "");
      setStarId(clip.related_star_id ?? "");
      setTags(clip.tags ?? "");
    }
  }, [isEditing, clip]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await MixcutOfficialClipsApi.updateOfficialClip(clip.id, {
        name,
        category,
        related_star_id: starId.trim() || null,
        tags,
      });
      onEditToggle(false);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            {clip.preview_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.preview_url} alt="" className="size-10 rounded object-cover bg-secondary" />
            ) : (
              <div className="size-10 rounded bg-secondary grid place-items-center">
                <Sparkles className="size-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{clip.name}</div>
              <div className="text-[11px] text-muted-foreground">{clip.id}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>{clip.official_category ?? "—"}</TableCell>
        <TableCell>{clip.related_star_id ?? "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{clip.tags ?? "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {formatDateCN(clip.uploaded_at)}
        </TableCell>
        <TableCell className="text-right">
          <div className="inline-flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEditToggle(true)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="size-3.5 text-red-500" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-secondary/30">
      <TableCell>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      </TableCell>
      <TableCell>
        <Select value={category || "__empty__"} onValueChange={(v) => setCategory(v === "__empty__" ? "" : v)}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input value={starId} onChange={(e) => setStarId(e.target.value)} className="h-8 w-32" placeholder="明星 ID（可空）" />
      </TableCell>
      <TableCell>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} className="h-8" placeholder="标签" />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDateCN(clip.uploaded_at)}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="size-3.5" /> 保存
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEditToggle(false)}>
            <X className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function UploadDialog({
  categories,
  onClose,
  onUploaded,
}: {
  categories: string[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState(categories[0] ?? "直播切片");
  const [starId, setStarId] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit = !!file && !!category.trim() && !submitting;

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      await MixcutOfficialClipsApi.uploadOfficialClip({
        file,
        category: category.trim(),
        name: name.trim() || undefined,
        relatedStarId: starId.trim() || undefined,
        tags: tags.trim() || undefined,
      });
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-background border border-border rounded-lg shadow-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">上传官方明星片段</h2>
            <p className="text-xs text-muted-foreground mt-0.5">视频文件 + 分类必填；用户端只读消费</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">视频文件 (mp4 / mov / webm)</label>
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">显示名称（可选，默认用文件名）</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：王某某 4月直播切片" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">分类 <span className="text-red-500">*</span></label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">关联明星 ID（可选）</label>
              <Input value={starId} onChange={(e) => setStarId(e.target.value)} placeholder="CelebrityStar.id" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">标签（逗号分隔，可选）</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例：新品,促销" />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5 text-sm text-red-500">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-secondary/30">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "上传中…" : "开始上传"}
          </Button>
        </div>
      </div>
    </div>
  );
}
