"use client";

// 画布竖条（56px）：logo 回「我的画布」、三步（剧本 / 角色和场景 / 逐集制作）、底部帮助。
// ≤720 变成底部三格页签（logo 和帮助收起，三格带文字）。样式见 styles/pages/canvas.css `.cv-rail`。
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CircleHelp, Clapperboard, FolderOpen, PlayCircle, X } from "lucide-react";
import type { DramaCanvasStep } from "@ai-star-eco/types/drama-canvas";
import { useModalA11y } from "@/lib/use-modal-a11y";

export const CANVAS_STEPS: { key: DramaCanvasStep; label: string; icon: React.ElementType; help: string }[] = [
  { key: "script", label: "剧本", icon: BookOpen, help: "粘贴写好的剧本，或者让 AI 按你的想法一段一段写。每一段都能直接改。" },
  {
    key: "assets",
    label: "角色和场景",
    icon: FolderOpen,
    help: "从剧本里拆出角色和场景，给每个造型出定妆照、给场景出场景图。这些图会用在所有集里。",
  },
  {
    key: "episodes",
    label: "逐集制作",
    icon: PlayCircle,
    help: "每集先生成分镜脚本，再按片段出首帧、生成视频，最后合成成片。",
  },
];

/** 当前在哪一步（按路径判断）。 */
export function stepOfPath(pathname: string | null, canvasId: string): DramaCanvasStep | null {
  if (!pathname) return null;
  const base = `/canvas/${canvasId}/`;
  if (!pathname.startsWith(base)) return null;
  const seg = pathname.slice(base.length).split("/")[0];
  return seg === "script" || seg === "assets" || seg === "episodes" ? seg : null;
}

export interface CanvasRailProps {
  canvasId: string;
}

export function CanvasRail({ canvasId }: CanvasRailProps) {
  const pathname = usePathname();
  const current = stepOfPath(pathname, canvasId);
  const [helpOpen, setHelpOpen] = React.useState(false);
  return (
    <>
      <nav className="cv-rail" aria-label="画布步骤">
        <Link href="/canvas" className="cv-rail-logo" aria-label="回到我的画布" title="回到我的画布">
          <Clapperboard size={17} strokeWidth={2.4} />
        </Link>
        <div className="cv-rail-steps">
          {CANVAS_STEPS.map((s) => {
            const Icon = s.icon;
            const active = current === s.key;
            return (
              <Link
                key={s.key}
                href={`/canvas/${encodeURIComponent(canvasId)}/${s.key}`}
                className={`cv-rail-item${active ? " on" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={s.label}
              >
                <Icon size={19} />
                <span className="cv-rail-label">{s.label}</span>
              </Link>
            );
          })}
        </div>
        <button type="button" className="cv-rail-help" onClick={() => setHelpOpen(true)} aria-label="画布怎么用" title="画布怎么用">
          <CircleHelp size={18} />
        </button>
      </nav>
      <CanvasHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

function CanvasHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(ref, onClose, open);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="画布怎么用"
        tabIndex={-1}
        className="card pop-in cv-help-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cv-style-head">
          <div className="cv-style-title">画布怎么用</div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="关闭">
            <X size={15} />
          </button>
        </div>
        <ol className="cv-help-steps">
          {CANVAS_STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.key}>
                <span className="cv-help-icon">
                  <Icon size={16} />
                </span>
                <div className="cv-help-copy">
                  <b>
                    {i + 1}. {s.label}
                  </b>
                  <span>{s.help}</span>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="cv-hint">花积分的按钮上都写着这次要花多少；改动会自动保存。</div>
      </div>
    </div>
  );
}
