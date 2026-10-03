"use client";

// 新建画布（v0.198，docs/drama-canvas-plan.md §2.2）：两个页签「粘贴写好的剧本」「让 AI 写剧本」、风格浮层、画幅、
// 集数 / 每集时长、开始。开始不花钱：建画布（粘贴的剧本由服务端按集切开）后进剧本页。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Upload } from "lucide-react";
import type { CanvasStyle, CreateDramaCanvasBody, DramaCanvasRatio } from "@ai-star-eco/types/drama-canvas";
import { CanvasApi } from "@/api/canvas";
import { ViewHeader } from "@/components/common";
import { StylePickerButton } from "@/canvas/shell/style-picker";
import { rememberSplitNotes } from "@/canvas/shell/split-notes";
import { DEFAULT_CANVAS_STYLE } from "@/constants/canvas-styles";
import { aiErrorMessage } from "@/lib/ai-error";
import { invalidate } from "@/lib/drama-query";

type Source = "paste" | "idea";

const PASTE_MAX = 100_000;
const IDEA_MAX = 500;
const EPISODE_OPTIONS = [1, 3, 5, 6, 8, 10, 12, 15, 20, 24, 30, 40, 50, 60, 80];
const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 30, label: "30 秒" },
  { value: 45, label: "45 秒" },
  { value: 60, label: "1 分钟" },
  { value: 90, label: "1 分半" },
  { value: 120, label: "2 分钟" },
  { value: 180, label: "3 分钟" },
];

const charCount = (s: string) => Array.from(s.trim()).length;

export default function NewCanvasPage() {
  const router = useRouter();
  const [source, setSource] = React.useState<Source>("paste");
  const [text, setText] = React.useState("");
  const [idea, setIdea] = React.useState("");
  const [episodes, setEpisodes] = React.useState(10);
  const [duration, setDuration] = React.useState(60);
  const [style, setStyle] = React.useState<CanvasStyle>(DEFAULT_CANVAS_STYLE);
  const [ratio, setRatio] = React.useState<DramaCanvasRatio>("9:16");
  const [dragOver, setDragOver] = React.useState(false);
  const [fileNote, setFileNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const textLen = charCount(text);
  const ideaLen = charCount(idea);
  const blockReason =
    source === "paste"
      ? textLen === 0
        ? "先把剧本粘贴进来"
        : textLen > PASTE_MAX
          ? `剧本有 ${textLen.toLocaleString("zh-CN")} 字，超过了 10 万字，删掉一些再开始`
          : null
      : ideaLen === 0
        ? "先写一句故事想法"
        : ideaLen > IDEA_MAX
          ? `想法最多 ${IDEA_MAX} 字，现在有 ${ideaLen} 字`
          : null;

  const readFile = async (file: File | undefined | null) => {
    setFileNote(null);
    if (!file) return;
    const isTxt = /\.txt$/i.test(file.name) || file.type === "text/plain";
    if (!isTxt) {
      setFileNote("现在只收 .txt 文件。Word 文件先把里面的文字复制进来。");
      return;
    }
    try {
      const content = await file.text();
      const n = charCount(content);
      if (n === 0) {
        setFileNote(`「${file.name}」是空的。`);
        return;
      }
      setText(content);
      setFileNote(`已读入「${file.name}」，${n.toLocaleString("zh-CN")} 字。`);
    } catch {
      setFileNote(`「${file.name}」没读出来，换个文件或者直接把文字粘贴进来。`);
    }
  };

  const start = async () => {
    if (blockReason || busy) return;
    setBusy(true);
    setError(null);
    const body: CreateDramaCanvasBody =
      source === "paste"
        ? { source, ratio, style, text: text.trim() }
        : { source, ratio, style, idea: idea.trim(), targetEpisodes: episodes, episodeDurationSec: duration };
    try {
      const created = await CanvasApi.create(body);
      // 切集说明只在这次响应里有：记下来，剧本页页首显示一次
      if (body.source === "paste" && Array.isArray(created.splitNotes)) rememberSplitNotes(created.id, created.splitNotes);
      invalidate("/me/drama/canvases");
      router.push(`/canvas/${encodeURIComponent(created.id)}/script`);
    } catch (e) {
      setError(aiErrorMessage(e, "画布没建成，请重试"));
      setBusy(false);
    }
  };

  return (
    <div className="cv-new">
      <ViewHeader title="新建画布" meta="粘贴写好的剧本，或者写一句想法让 AI 写。新建不花积分。" />

      <div className="card cv-new-card">
        <div className="cv-tabs" role="tablist" aria-label="剧本从哪来">
          <button type="button" role="tab" aria-selected={source === "paste"} className={`cv-tab${source === "paste" ? " on" : ""}`} onClick={() => setSource("paste")}>
            粘贴写好的剧本
          </button>
          <button type="button" role="tab" aria-selected={source === "idea"} className={`cv-tab${source === "idea" ? " on" : ""}`} onClick={() => setSource("idea")}>
            让 AI 写剧本
          </button>
        </div>

        {source === "paste" ? (
          <div className="col gap-2">
            <div
              className={`cv-drop${dragOver ? " over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void readFile(e.dataTransfer.files?.[0]);
              }}
            >
              <textarea
                className="cv-textarea cv-new-paste"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="剧本原文"
                placeholder={"把剧本粘贴到这里，也可以把 .txt 文件拖进来。\n有「第 1 集」「第 2 集」这样的标记时，会按集切开；没有就整篇当作第 1 集。"}
              />
              {dragOver && (
                <div className="cv-drop-mask">
                  <Upload size={20} /> 松手读入这个 .txt 文件
                </div>
              )}
            </div>
            <div className="cv-new-row">
              <button type="button" className="btn btn-line btn-sm" onClick={() => fileRef.current?.click()}>
                <FileText size={14} /> 选一个 .txt 文件
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,text/plain"
                hidden
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <span className="grow" />
              <span className={`cv-count${textLen > PASTE_MAX ? " over" : ""}`}>
                {textLen.toLocaleString("zh-CN")} / {PASTE_MAX.toLocaleString("zh-CN")} 字
              </span>
            </div>
            {fileNote && <div className="cv-hint">{fileNote}</div>}
            <div className="cv-hint">Word 文件先把里面的文字复制进来，现在只收 .txt。</div>
          </div>
        ) : (
          <div className="col gap-3">
            <div className="col gap-2">
              <label htmlFor="cv-new-idea" className="cv-field-label">
                说说你的故事想法
              </label>
              <textarea
                id="cv-new-idea"
                className="cv-textarea cv-new-idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="比如：夜班公交司机发现，每晚在同一站上车的女孩，总会在座位上落下一样东西。"
              />
              <div className="cv-new-row">
                <span className="cv-hint">AI 先写故事大纲，你通过了再写分集剧情和每一集的剧本，每一段都能改。</span>
                <span className="grow" />
                <span className={`cv-count${ideaLen > IDEA_MAX ? " over" : ""}`}>
                  {ideaLen} / {IDEA_MAX} 字
                </span>
              </div>
            </div>
            <div className="cv-new-row">
              <label className="cv-inline-field">
                <span>集数</span>
                <select className="cv-select" value={episodes} onChange={(e) => setEpisodes(Number(e.target.value))}>
                  {EPISODE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} 集
                    </option>
                  ))}
                </select>
              </label>
              <label className="cv-inline-field">
                <span>每集时长</span>
                <select className="cv-select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="cv-new-foot">
          <StylePickerButton className="btn btn-line btn-sm" value={style} onChange={setStyle} />
          <div className="cv-seg" role="radiogroup" aria-label="画幅">
            {(["9:16", "16:9"] as DramaCanvasRatio[]).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={ratio === r} className={ratio === r ? "on" : ""} onClick={() => setRatio(r)}>
                {r === "9:16" ? "竖屏 9:16" : "横屏 16:9"}
              </button>
            ))}
          </div>
          <div className="cv-new-start">
            <span className="cv-hint">不花积分</span>
            <button type="button" className="btn btn-grad" onClick={() => void start()} disabled={!!blockReason || busy} aria-busy={busy || undefined}>
              {busy ? "正在建…" : "开始"} <ArrowRight size={15} />
            </button>
          </div>
        </div>
        {blockReason && <div className="cv-hint cv-new-reason">{blockReason}</div>}
        <div className="cv-hint">画幅建好之后不能改，整部剧的首帧、视频和成片都用它。</div>
        {error && <div className="cv-error">{error}</div>}
      </div>
    </div>
  );
}
