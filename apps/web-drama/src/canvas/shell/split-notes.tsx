"use client";

// 粘贴剧本新建后的「切集说明」（v0.198）：新建响应里的 splitNotes 只有那一次有（GET 详情不带），
// 新建页把它存进 sessionStorage，剧本页页首读到就显示一次（可关闭），读完即删。
// 存取都 try/catch：隐私模式下存不了就不显示，不影响别的。
import * as React from "react";
import { Scissors, X } from "lucide-react";

const PREFIX = "drama-canvas-split-notes:";

/** 新建页调：记下这张画布的切集说明（source=paste 且响应里带了 splitNotes 时）。 */
export function rememberSplitNotes(canvasId: string, notes: string[]): void {
  try {
    window.sessionStorage.setItem(PREFIX + canvasId, JSON.stringify(notes.filter((n) => typeof n === "string")));
  } catch {
    /* 存不下就算了：剧本页只是少一条说明 */
  }
}

/** 读出并删掉（只显示一次）。没有 → null。 */
export function takeSplitNotes(canvasId: string): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + canvasId);
    if (raw === null) return null;
    window.sessionStorage.removeItem(PREFIX + canvasId);
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return null;
  }
}

export interface SplitNotesBannerProps {
  canvasId: string;
  /** 现在剧本里有几集。 */
  episodeCount: number;
}

/** 剧本页页首的切集说明块（没有记下的说明时什么都不画）。 */
export function SplitNotesBanner({ canvasId, episodeCount }: SplitNotesBannerProps) {
  const [notes, setNotes] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    const got = takeSplitNotes(canvasId);
    // 开发模式下 effect 会跑两遍：第二遍读到的是空，不要把第一遍读到的冲掉
    if (got) setNotes(got);
  }, [canvasId]);
  if (!notes) return null;
  // 服务端的第一条就是总述（「按「第 X 集」切成了 N 集」或「没找到「第 X 集」标记，整篇当作第 1 集」），拿它当标题；
  // 没给说明时按现在的集数说一句
  const [head, ...rest] = notes.length ? notes : [`按「第 X 集」切成了 ${episodeCount} 集`];
  return (
    <div className="cv-split-notes" role="status">
      <Scissors size={15} />
      <div className="cv-split-notes-body">
        <div className="cv-split-notes-title">{head}</div>
        {rest.length > 0 && (
          <ul className="cv-split-notes-list">
            {rest.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className="btn btn-icon btn-ghost btn-sm tap-target" aria-label="关掉这条说明" title="关掉这条说明" onClick={() => setNotes(null)}>
        <X size={14} />
      </button>
    </div>
  );
}
