"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog, Field, TextInput, Select } from "@/components/common";
import { FilmApi } from "@/api";
import { ApiError } from "@ai-star-eco/api-client";
import type { Drama, DramaStatus } from "@ai-star-eco/types/film";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (d: Drama) => void;
  /** 预填的主演（来自演员详情触发）。 */
  defaultRole?: string;
}

const GENRES = ["都市悬疑", "青春治愈", "都市情感", "年代悬疑", "古风轻喜", "现实题材", "轻喜短剧"];
const STATUSES: Array<{ value: DramaStatus; label: string }> = [
  { value: "casting", label: "选角中" },
  { value: "filming", label: "制作中" },
  { value: "post-production", label: "后期制作" },
];

export function NewProjectDialog({ open, onOpenChange, onCreated, defaultRole }: Props) {
  const [title, setTitle] = React.useState("");
  const [genre, setGenre] = React.useState(GENRES[0]!);
  const [episodes, setEpisodes] = React.useState(12);
  const [role, setRole] = React.useState(defaultRole ?? "");
  const [status, setStatus] = React.useState<DramaStatus>("casting");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setGenre(GENRES[0]!);
      setEpisodes(12);
      setRole(defaultRole ?? "");
      setStatus("casting");
      setErr(null);
    }
  }, [open, defaultRole]);

  async function submit() {
    setErr(null);
    if (!title.trim()) {
      setErr("剧名不能为空");
      return;
    }
    if (episodes < 0 || episodes > 200) {
      setErr("集数应在 0–200 之间");
      return;
    }
    try {
      const d = await FilmApi.createDrama({
        title: title.trim(),
        genre,
        episodes,
        role: role.trim() || "主演待定",
        status,
      });
      onOpenChange(false);
      onCreated(d);
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
      title="创建新项目"
      description="录入基础信息，进入项目详情后可继续添加集数、绑定演员、安排排期。"
      submitLabel="创建"
      width={560}
      onSubmit={submit}
    >
      <Field label="剧名" required>
        <TextInput
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
          placeholder="如：暮色未央"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="类型">
          <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="计划集数">
          <TextInput
            type="number"
            min={0}
            max={200}
            value={episodes}
            onChange={(e) => setEpisodes(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="主演（自由填写）" hint="若有多人，用「+」分隔，如 苏念 + 陆烬">
        <TextInput value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} />
      </Field>
      <Field label="启动状态">
        <Select value={status} onChange={(e) => setStatus(e.target.value as DramaStatus)}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      {err && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: -4 }}>{err}</div>}
    </FormDialog>
  );
}
