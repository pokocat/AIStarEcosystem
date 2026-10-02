"use client";

// 「发布成模板」确认弹窗（v0.197 统一叫法：模板 / 模板广场 / 我发布的模板）。
// 点确认只是提交平台审核，审核通过后才出现在模板广场，按钮如实写「提交审核」。
// 第三轮：短剧和短视频整理进模板的东西不一样（DramaRecipeService#distillAndSave / distillAndSaveShort），
// 文案按 kind 分开写 —— 此前短剧也显示「这条成片的分镜结构」「原视频不受影响」。
import * as React from "react";
import { Boxes, CheckCircle2, Sparkles, TrendingUp, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";

export type PublishTemplateKind = "series" | "short";

interface PublishCreativeCenterModalProps {
  title: string;
  /** 发布的是短剧（series）还是短视频（short）。不传按短视频。 */
  kind?: PublishTemplateKind;
  publishing?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const COPY: Record<PublishTemplateKind, { subtitle: (title: string) => string; intro: string; benefits: { icon: typeof Sparkles; text: string }[] }> = {
  short: {
    subtitle: (title) => `别人可以照《${title}》的结构做同款`,
    intro: "我们会把这条成片的风格、节奏和分镜结构整理成一个模板，先交平台审核。审核通过后，其他人能在模板广场里做同款。",
    benefits: [
      { icon: Sparkles, text: "别人拿到的是结构和风格，要换成自己的主题和角色" },
      { icon: TrendingUp, text: "审核没通过会告诉你原因，改了可以再发" },
      { icon: CheckCircle2, text: "原视频不受影响。审核进度和多少人用过，在「我发布的模板」里看" },
    ],
  },
  series: {
    subtitle: (title) => `别人可以照《${title}》的故事做同款`,
    intro: "我们会把这部短剧的故事主线、每集看点和角色设定整理成一个模板，先交平台审核。审核通过后，其他人能在模板广场里做同款。",
    benefits: [
      // 角色进模板时只留设定（cast 清空、bound=false，见 DramaRecipeService#seedProjectFromRecipe），你绑的数字人不会跟过去
      { icon: Sparkles, text: "别人做同款时会带上这些角色的设定，不会带走你绑定的数字人" },
      { icon: TrendingUp, text: "审核没通过会告诉你原因，改了可以再发" },
      { icon: CheckCircle2, text: "你的短剧不受影响。审核进度和多少人用过，在「我发布的模板」里看" },
    ],
  },
};

export function PublishCreativeCenterModal({
  title,
  kind = "short",
  publishing = false,
  onClose,
  onConfirm,
}: PublishCreativeCenterModalProps) {
  const copy = COPY[kind];
  const subtitle = copy.subtitle(title);
  return (
    <ModalShell
      onClose={publishing ? () => {} : onClose}
      label={`发布成模板 · ${title}`}
      overlayZIndex={110}
      className="card pop-in col mk-modal"
      style={{ width: 448, maxWidth: "100%", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
    >
      <div style={{ padding: "18px 20px 16px", borderBottom: "1px solid var(--line-soft)" }}>
        <div className="row gap-3">
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              flex: "none",
              color: "var(--accent)",
              background: "var(--accent-soft)",
            }}
          >
            <Boxes size={19} />
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>发布成模板</div>
            <div
              className="faint"
              title={subtitle}
              style={{ marginTop: 2, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {subtitle}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-sm"
            aria-label="关闭"
            onClick={onClose}
            disabled={publishing}
            style={{ flex: "none", width: 30, height: 30, border: "1px solid var(--line-2)", background: "var(--surface)" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="col gap-3" style={{ padding: "16px 20px 18px" }}>
        <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>
          {copy.intro}
        </p>
        <div className="col gap-2" style={{ padding: "12px 13px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line-soft)" }}>
          {copy.benefits.map(({ icon: Icon, text }) => (
            <div key={text} className="row gap-2" style={{ alignItems: "flex-start" }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 8,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--accent)",
                  background: "var(--surface)",
                  border: "1px solid var(--line-soft)",
                }}
              >
                <Icon size={12} />
              </span>
              <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{text}</span>
            </div>
          ))}
        </div>
        <div className="row gap-2" style={{ justifyContent: "flex-end", paddingTop: 2 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={publishing}>
            取消
          </button>
          <button type="button" className="btn btn-grad" onClick={onConfirm} disabled={publishing} aria-busy={publishing}>
            <Boxes size={15} /> {publishing ? "提交中…" : "提交审核"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
