"use client";

// 明星新增 / 编辑表单（v0.55+：web-celebrity 内嵌运营管理）。
// 移植自 apps/admin 的 StarFormDialog，改用 @ai-star-eco/ui 原语 + web-celebrity 设计令牌。
// 写操作走 CelebrityZoneApi.{createStar,updateStar}（URL → /admin/celebrity/stars）；
// 图片走 CelebrityZoneApi.uploadCelebrityImage（→ /admin/celebrity/uploads）。

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Textarea } from "@ai-star-eco/ui/ui/textarea";
import { Switch } from "@ai-star-eco/ui/ui/switch";
import { Button } from "@ai-star-eco/ui/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";
import type {
  CelebrityCategory,
  CelebrityStar,
  PricingTierName,
} from "@ai-star-eco/types/celebrity-zone";
import { CelebrityZoneApi } from "@/api";

const CATEGORIES: CelebrityCategory[] = ["演员", "歌手", "主持人", "运动员", "网红", "综艺"];
const PRICING_TIERS: PricingTierName[] = ["体验版", "标准版", "旗舰版"];

interface Props {
  /** 编辑模式传入；新建为 null。 */
  star: CelebrityStar | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function StarFormDialog({ star, onClose, onSaved }: Props) {
  const isEdit = !!star;
  const [name, setName] = React.useState(star?.name ?? "");
  const [category, setCategory] = React.useState<CelebrityCategory>(star?.category ?? "演员");
  const [avatar, setAvatar] = React.useState(star?.avatar ?? "");
  const [cover, setCover] = React.useState(star?.cover ?? "");
  const [description, setDescription] = React.useState(star?.description ?? "");
  const [pricingTier, setPricingTier] = React.useState<PricingTierName>(
    star?.pricingTier ?? "标准版",
  );
  const [startingPrice, setStartingPrice] = React.useState(star?.startingPrice ?? "¥99起");
  const [isHot, setIsHot] = React.useState(star?.isHot ?? false);
  const [quotaTotal, setQuotaTotal] = React.useState<number>(star?.quotaTotal ?? 100);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("明星名称必填");
      return;
    }
    if (!avatar.trim()) {
      setError("头像 URL 必填");
      return;
    }
    setSaving(true);
    try {
      const body: Partial<CelebrityStar> = {
        name: name.trim(),
        category,
        avatar: avatar.trim(),
        cover: cover.trim() || undefined,
        description: description.trim() || undefined,
        pricingTier,
        startingPrice,
        isHot,
        quotaTotal,
      };
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
            <Field label="头像">
              <ImageField value={avatar} onChange={setAvatar} kind="avatar" placeholder="贴 URL 或点「上传」" required />
            </Field>
            <Field label="封面">
              <ImageField value={cover} onChange={setCover} kind="cover" placeholder="贴 URL 或点「上传」" />
            </Field>
            <Field label="套餐档位">
              <Select value={pricingTier} onValueChange={(v) => setPricingTier(v as PricingTierName)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICING_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                <span className="ml-2 text-sm text-zinc-500">{isHot ? "🔥 显示热门" : "不显示"}</span>
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
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

/** 图片字段：URL 输入 + 上传按钮二合一。上传成功后把返回的 public URL 回填。 */
function ImageField({
  value,
  onChange,
  kind,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  kind: "avatar" | "cover" | "preview" | "photo";
  placeholder?: string;
  required?: boolean;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
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
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "上传中…" : "上传"}
        </Button>
      </div>
      {value && (
        <img src={value} alt="" className="h-16 w-16 rounded object-cover border border-zinc-200" onError={(e) => (e.currentTarget.style.display = "none")} />
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
