"use client";

// 新建互动短剧 —— 选剧名 / 题材 / 起始骨架，立即落库并跳进编辑器。

import * as React from "react";
import { toast } from "sonner";
import { Dialog, Field, TextInput, Select } from "@/components/common";
import { Button } from "@/components/premium";
import { ApiError } from "@ai-star-eco/api-client";
import * as InteractiveDramaApi from "@/api/interactive-drama";
import type { InteractiveSeries } from "@/api/interactive-drama";

const GENRES = ["都市悬疑", "都市甜宠", "古装宫斗", "科幻短剧", "社会热点", "校园青春", "自定义"];

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (series: InteractiveSeries) => void;
}

export function NewSeriesDialog({ open, onOpenChange, onCreated }: Props) {
  const [title, setTitle] = React.useState("");
  const [genre, setGenre] = React.useState(GENRES[0]);
  const [skeleton, setSkeleton] = React.useState<"branch" | "single">("branch");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setGenre(GENRES[0]);
      setSkeleton("branch");
    }
  }, [open]);

  async function submit() {
    if (!title.trim()) {
      toast.error("请先填写剧名");
      return;
    }
    setBusy(true);
    try {
      const s = await InteractiveDramaApi.createSeries({ title: title.trim(), genre, skeleton });
      onCreated(s);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="新建互动短剧"
      description="互动发生在剧集之间：某集播完弹出选项，观众的选择决定下一集播哪条分支。"
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            创建
          </Button>
        </>
      }
    >
      <Field label="剧名" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：落地窗后 · 互动版" autoFocus />
      </Field>
      <Field label="题材">
        <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="起始结构" hint="先给你一个骨架，进去再增删剧集和分支。">
        <Select value={skeleton} onChange={(e) => setSkeleton(e.target.value as "branch" | "single")}>
          <option value="branch">带一个分支点的示例（推荐）</option>
          <option value="single">单集起步</option>
        </Select>
      </Field>
    </Dialog>
  );
}
