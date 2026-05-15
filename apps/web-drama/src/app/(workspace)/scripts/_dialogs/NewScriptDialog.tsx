"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog, Field, TextInput, Select, TextArea } from "@/components/common";
import { ScriptsApi } from "@/api";
import { ApiError } from "@ai-star-eco/api-client";
import type { Script, ScriptKind } from "@ai-star-eco/types/script";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (s: Script) => void;
  defaultDramaId?: string;
  defaultSeries?: string;
}

const KINDS: Array<{ value: ScriptKind; label: string }> = [
  { value: "drama", label: "剧集" },
  { value: "trailer", label: "宣传片" },
  { value: "ad", label: "广告" },
  { value: "voice", label: "配音稿" },
];

export function NewScriptDialog({
  open,
  onOpenChange,
  onCreated,
  defaultDramaId,
  defaultSeries,
}: Props) {
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<ScriptKind>("drama");
  const [series, setSeries] = React.useState(defaultSeries ?? "");
  const [episode, setEpisode] = React.useState("");
  const [initialContent, setInitialContent] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setKind("drama");
      setSeries(defaultSeries ?? "");
      setEpisode("");
      setInitialContent("");
      setErr(null);
    }
  }, [open, defaultSeries]);

  async function submit() {
    setErr(null);
    if (!title.trim()) {
      setErr("脚本标题不能为空");
      return;
    }
    try {
      const s = await ScriptsApi.createScript({
        title: title.trim(),
        kind,
        series: series.trim() || undefined,
        episode: episode.trim() || undefined,
        dramaId: defaultDramaId,
        initialContent: initialContent.trim() || undefined,
      });
      onOpenChange(false);
      onCreated(s);
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
      title="新建脚本"
      description="可以直接生成空白稿，进入编辑器后再调用 AI 续写。"
      submitLabel="创建并进入编辑"
      width={560}
      onSubmit={submit}
    >
      <Field label="标题" required>
        <TextInput
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="如：《暮色未央》EP10 · 雨夜对峙"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="类型">
          <Select value={kind} onChange={(e) => setKind(e.target.value as ScriptKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="所属剧集">
          <TextInput value={series} onChange={(e) => setSeries(e.target.value)} placeholder="可空" />
        </Field>
      </div>
      <Field label="集 / 场">
        <TextInput value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="如：EP10 / 第 2 场" />
      </Field>
      <Field label="开头几句（可选）" hint="留空将从空白页开始。">
        <TextArea
          rows={4}
          value={initialContent}
          onChange={(e) => setInitialContent(e.target.value)}
          placeholder="（场景一 · 雨夜便利店……）"
        />
      </Field>
      {err && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: -4 }}>{err}</div>}
    </FormDialog>
  );
}
