"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog, Field, TextInput, Select, TextArea } from "@/components/common";
import { ArtistsApi } from "@/api";
import { ApiError } from "@ai-star-eco/api-client";
import type { Artist } from "@ai-star-eco/types/artist";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (a: Artist) => void;
}

const QUALITIES: Array<{ value: Artist["quality"]; label: string }> = [
  { value: "legendary", label: "S 类 · Legendary" },
  { value: "epic", label: "A 类 · Epic" },
  { value: "rare", label: "B 类 · Rare" },
  { value: "common", label: "C 类 · Common" },
];

const TYPES: Array<{ value: Artist["type"]; label: string }> = [
  { value: "actor", label: "演员" },
  { value: "all_rounder", label: "全能型" },
  { value: "dancer", label: "舞者 / 配演" },
];

export function NewArtistDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = React.useState("");
  const [quality, setQuality] = React.useState<Artist["quality"]>("rare");
  const [type, setType] = React.useState<Artist["type"]>("actor");
  const [bio, setBio] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setQuality("rare");
      setType("actor");
      setBio("");
      setErr(null);
    }
  }, [open]);

  async function submit() {
    setErr(null);
    if (!name.trim()) {
      setErr("演员名不能为空");
      return;
    }
    try {
      const artist = await ArtistsApi.createArtist({
        name: name.trim(),
        quality,
        type,
        bio: bio.trim() || "新入驻演员，等待首部作品。",
        status: "trainee",
      });
      onOpenChange(false);
      onCreated(artist);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "创建失败";
      toast.error(msg);
      setErr(msg);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="新增演员 IP"
      description="先填基础档案，进入孵化流程后可继续完善形象与声线。"
      submitLabel="创建"
      width={520}
      onSubmit={submit}
    >
      <Field label="艺名" required error={err && !name.trim() ? err : undefined}>
        <TextInput
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：苏念"
          maxLength={32}
        />
      </Field>
      <Field label="级别">
        <Select value={quality} onChange={(e) => setQuality(e.target.value as Artist["quality"])}>
          {QUALITIES.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="类型">
        <Select value={type} onChange={(e) => setType(e.target.value as Artist["type"])}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="简介" hint="一句话定位（≤ 80 字）">
        <TextArea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={80} rows={3} placeholder="如：实力派 AI 演员，擅长悬疑短剧。" />
      </Field>
      {err && !err.includes("名不能为空") && (
        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: -4 }}>{err}</div>
      )}
    </FormDialog>
  );
}
