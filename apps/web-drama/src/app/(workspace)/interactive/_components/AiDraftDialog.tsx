"use client";

// AI 起草互动剧 —— 一句话主题 → 大模型直接生成一张可玩的剧集分支图（含互动点 / 选项 / 结局）。
// 与短剧 / 短视频工坊一致的「AI 起草」体验，mock 走本地生成器，live 走后端 LLM。

import * as React from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Dialog, Field, TextArea, Select } from "@/components/common";
import { Button } from "@/components/premium";
import { aiErrorMessage } from "@/lib/ai-error";
import * as InteractiveDramaApi from "@/api/interactive-drama";
import type { InteractiveSeries } from "@/api/interactive-drama";

const GENRES = ["都市悬疑", "都市甜宠", "古装宫斗", "科幻短剧", "社会热点", "校园青春", "自定义"];

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: (series: InteractiveSeries) => void;
}

export function AiDraftDialog({ open, onOpenChange, onCreated }: Props) {
  const [theme, setTheme] = React.useState("");
  const [genre, setGenre] = React.useState(GENRES[0]);
  const [branchPoints, setBranchPoints] = React.useState(1);
  const [endings, setEndings] = React.useState(2);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTheme("");
      setGenre(GENRES[0]);
      setBranchPoints(1);
      setEndings(2);
    }
  }, [open]);

  async function submit() {
    if (!theme.trim()) {
      toast.error("请先填写故事主题 / 一句话灵感");
      return;
    }
    setBusy(true);
    try {
      const s = await InteractiveDramaApi.aiDraftSeries({
        theme: theme.trim(),
        genre,
        branch_points: branchPoints,
        endings,
      });
      onCreated(s);
      onOpenChange(false);
    } catch (e) {
      toast.error(aiErrorMessage(e, "AI 起草失败，请稍后重试"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="AI 起草互动剧"
      description="给一句话灵感，AI 直接为你搭好一张剧集分支图（起始集 + 互动点 + 选项 + 多结局），进去再改。"
      width={540}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            <Sparkles size={14} /> {busy ? "AI 起草中…" : "AI 起草"}
          </Button>
        </>
      }
    >
      <Field label="故事主题 / 一句话灵感" required>
        <TextArea
          rows={2}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="例如：失忆总裁在咖啡馆偶遇前妻，一次选择决定两人能否重来"
          autoFocus
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="题材">
          <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="互动点">
          <Select value={branchPoints} onChange={(e) => setBranchPoints(Number(e.target.value))}>
            <option value={1}>1 个</option>
            <option value={2}>2 个</option>
          </Select>
        </Field>
        <Field label="结局数">
          <Select value={endings} onChange={(e) => setEndings(Number(e.target.value))}>
            <option value={2}>2 个</option>
            <option value={3}>3 个</option>
            <option value={4}>4 个</option>
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
