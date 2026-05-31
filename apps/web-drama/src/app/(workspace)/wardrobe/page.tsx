"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Shirt, Trash2, Upload, Users } from "lucide-react";
import type { ClothingItem } from "@ai-star-eco/types/wardrobe";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  LoadingBlock,
  SectionHeader,
  Select,
  StatusBadge,
  TextInput,
  ViewHeader,
} from "@/components/common";
import { ArtistsApi, WardrobeApi } from "@/api";
import { useAsync, invalidate, mutate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

type Kind = "all" | "top" | "bottom" | "accessory" | "shoes" | "hair";

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: "all", label: "全部" },
  { id: "top", label: "上衣" },
  { id: "bottom", label: "下装" },
  { id: "shoes", label: "鞋子" },
  { id: "accessory", label: "配饰" },
  { id: "hair", label: "发型" },
];

const RARITY_TONE: Record<ClothingItem["rarity"], "accent" | "violet" | "info" | "neutral"> = {
  legendary: "accent",
  epic: "violet",
  rare: "info",
  common: "neutral",
};

const RARITY_LABEL: Record<ClothingItem["rarity"], string> = {
  legendary: "S 类",
  epic: "A 类",
  rare: "B 类",
  common: "C 类",
};

// 戏服分配（mock 本地）：itemId -> artistId[]
const ASSIGN_KEY = "drama:wardrobe:assignments";
function loadAssign(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ASSIGN_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveAssign(v: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ASSIGN_KEY, JSON.stringify(v));
}

export default function WardrobePage() {
  return (
    <React.Suspense fallback={null}>
      <WardrobeInner />
    </React.Suspense>
  );
}

function WardrobeInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const kindInit = (sp.get("kind") as Kind) ?? "all";
  const [kind, setKind] = React.useState<Kind>(kindInit);
  const [q, setQ] = React.useState("");
  const [assign, setAssign] = React.useState<Record<string, string[]>>({});
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [assignTarget, setAssignTarget] = React.useState<ClothingItem | null>(null);
  const [delTarget, setDelTarget] = React.useState<ClothingItem | null>(null);

  React.useEffect(() => setAssign(loadAssign()), []);
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    window.history.replaceState(null, "", `/wardrobe${params.toString() ? `?${params}` : ""}`);
  }, [kind]);

  const itemsQ = useAsync<ClothingItem[]>("/wardrobe/items", () => WardrobeApi.listClothing());
  const artistsQ = useAsync<Artist[]>("/me/artists", () => ArtistsApi.listArtists());

  const items = itemsQ.data ?? [];
  const artists = artistsQ.data ?? [];

  const filtered = items.filter((it) => {
    if (kind !== "all" && it.category !== kind) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (!it.name.toLowerCase().includes(needle) && !it.tags.some((t) => t.toLowerCase().includes(needle)))
        return false;
    }
    return true;
  });

  // Uploaded items 在客户端缓存（仅 mock 演示）
  const [uploaded, setUploaded] = React.useState<ClothingItem[]>([]);
  const allDisplay = React.useMemo(() => [...uploaded, ...filtered], [uploaded, filtered]);

  function handleAssign(itemId: string, artistIds: string[]) {
    const next = { ...assign, [itemId]: artistIds };
    setAssign(next);
    saveAssign(next);
  }

  function handleDelete() {
    if (!delTarget) return;
    setUploaded(uploaded.filter((u) => u.id !== delTarget.id));
    const next = { ...assign };
    delete next[delTarget.id];
    setAssign(next);
    saveAssign(next);
    toast.success(`${delTarget.name} 已下架`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="wardrobe & props"
        title={
          <>
            戏服{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              与道具
            </span>
          </>
        }
        meta={`${items.length} 件素材 · ${uploaded.length} 件本次上传`}
        action={
          <Button variant="primary" size="md" onClick={() => setUploadOpen(true)}>
            <Upload size={14} />
            上传素材
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="素材总数" value={String(items.length + uploaded.length)} tone="accent" />
        <KpiCard label="本月新增" value={String(items.filter((i) => i.isNew).length + uploaded.length)} tone="info" />
        <KpiCard label="已分配演员" value={String(Object.values(assign).flat().length)} tone="success" />
        <KpiCard label="S 类珍稀" value={String(items.filter((i) => i.rarity === "legendary").length)} tone="violet" />
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--surface-1)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Search size={14} color="var(--fg-2)" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="按名称或 tag 搜索素材…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--fg-0)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {KINDS.map((k) => {
            const active = kind === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--fg-1)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </Card>

      {itemsQ.isLoading && <LoadingBlock rows={3} height={140} />}
      {!itemsQ.isLoading && allDisplay.length === 0 && (
        <EmptyState
          icon={<Shirt size={28} />}
          title="没有匹配的素材"
          description="清除筛选或上传一件新素材。"
        />
      )}
      {!itemsQ.isLoading && allDisplay.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {allDisplay.map((it) => {
            const assignedIds = assign[it.id] ?? [];
            const isUploaded = uploaded.some((u) => u.id === it.id);
            return (
              <Card
                key={it.id}
                style={{
                  padding: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    height: 160,
                    background: it.imageUrl
                      ? `url(${it.imageUrl}) center/cover`
                      : "linear-gradient(135deg, rgba(212,175,106,0.25), rgba(164,76,255,0.18))",
                    position: "relative",
                  }}
                >
                  <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 4 }}>
                    <Chip tone={RARITY_TONE[it.rarity]}>{RARITY_LABEL[it.rarity]}</Chip>
                    {it.isNew && <Chip tone="success">新</Chip>}
                    {it.isTrending && <Chip tone="violet">热</Chip>}
                  </div>
                </div>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>{it.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>
                    {it.tags.slice(0, 3).join(" · ") || it.category}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-2)" }}>
                    分配给 {assignedIds.length} 位演员
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ flex: 1 }}
                      onClick={() => setAssignTarget(it)}
                    >
                      <Users size={11} />
                      分配
                    </Button>
                    {isUploaded && (
                      <Button variant="ghost" size="sm" onClick={() => setDelTarget(it)}>
                        <Trash2 size={11} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(it) => {
          setUploaded((prev) => [it, ...prev]);
          toast.success(`${it.name} 已加入素材库`);
        }}
      />

      <AssignDialog
        item={assignTarget}
        onClose={() => setAssignTarget(null)}
        artists={artists}
        initial={assignTarget ? assign[assignTarget.id] ?? [] : []}
        onConfirm={(ids) => {
          if (!assignTarget) return;
          handleAssign(assignTarget.id, ids);
          toast.success(`${assignTarget.name} 已分配给 ${ids.length} 位演员`);
        }}
      />

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="下架素材"
        description={`将下架「${delTarget?.name ?? ""}」，分配关系也会移除。`}
        destructive
        confirmLabel="下架"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ── 上传 dialog ─────────────────────────────────────────────────────────────

function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onUploaded: (it: ClothingItem) => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<ClothingItem["category"]>("top");
  const [rarity, setRarity] = React.useState<ClothingItem["rarity"]>("rare");
  const [tags, setTags] = React.useState("");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setCategory("top");
      setRarity("rare");
      setTags("");
      setPreview(null);
    }
  }, [open]);

  function handleFile(f: File) {
    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("请填写素材名称");
      return;
    }
    setUploading(true);
    await new Promise((r) => setTimeout(r, 1200));
    const it: ClothingItem = {
      id: `up-${Date.now()}`,
      name: name.trim(),
      category,
      imageUrl: preview ?? "",
      rarity,
      price: 0,
      tags: tags.split(/[,，\s]+/).filter(Boolean),
      isNew: true,
    };
    setUploading(false);
    onOpenChange(false);
    onUploaded(it);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (uploading) return;
        onOpenChange(o);
      }}
      title="上传新素材"
      description="选一张参考图、起个名、打 tag。"
      width={560}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={uploading}>
            取消
          </Button>
          <Button variant="primary" size="md" loading={uploading} onClick={submit}>
            <Upload size={13} />
            上传
          </Button>
        </>
      }
    >
      <Field label="参考图">
        <div
          style={{
            position: "relative",
            height: 200,
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--line-2)",
            background: preview ? `url(${preview}) center/cover` : "var(--surface-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          {!preview && (
            <div style={{ textAlign: "center", color: "var(--fg-2)" }}>
              <Plus size={20} />
              <div style={{ fontSize: 12, marginTop: 6 }}>点击选择本地图片</div>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
          />
        </div>
      </Field>
      <Field label="名称" required>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="如：午夜风衣" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="分类">
          <Select value={category} onChange={(e) => setCategory(e.target.value as ClothingItem["category"])}>
            <option value="top">上衣</option>
            <option value="bottom">下装</option>
            <option value="shoes">鞋子</option>
            <option value="accessory">配饰</option>
            <option value="hair">发型</option>
          </Select>
        </Field>
        <Field label="稀有度">
          <Select value={rarity} onChange={(e) => setRarity(e.target.value as ClothingItem["rarity"])}>
            <option value="legendary">S 类</option>
            <option value="epic">A 类</option>
            <option value="rare">B 类</option>
            <option value="common">C 类</option>
          </Select>
        </Field>
      </div>
      <Field label="标签" hint="用逗号或空格分隔。">
        <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cinematic, urban" />
      </Field>
    </Dialog>
  );
}

// ── 分配 dialog ─────────────────────────────────────────────────────────────

function AssignDialog({
  item,
  onClose,
  artists,
  initial,
  onConfirm,
}: {
  item: ClothingItem | null;
  onClose: () => void;
  artists: Artist[];
  initial: string[];
  onConfirm: (ids: string[]) => void;
}) {
  const [picked, setPicked] = React.useState<Set<string>>(new Set(initial));
  React.useEffect(() => {
    setPicked(new Set(initial));
  }, [initial, item?.id]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={item ? `分配「${item.name}」` : ""}
      description="勾选要绑定的演员。"
      width={460}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              onConfirm(Array.from(picked));
              onClose();
            }}
          >
            确认（{picked.size}）
          </Button>
        </>
      }
    >
      {artists.length === 0 && <EmptyState icon={<Users size={20} />} title="还没有演员" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
        {artists.map((a) => {
          const checked = picked.has(a.id);
          return (
            <label
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: checked ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--surface-1)",
                border: checked
                  ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)"
                  : "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} style={{ accentColor: "var(--accent)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{a.name}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>
                  {a.type}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </Dialog>
  );
}
