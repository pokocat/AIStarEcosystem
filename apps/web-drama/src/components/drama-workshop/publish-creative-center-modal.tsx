"use client";

import * as React from "react";
import { Boxes, CheckCircle2, Sparkles, TrendingUp, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";

interface PublishCreativeCenterModalProps {
  title: string;
  publishing?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const BENEFITS = [
  { icon: Sparkles, text: "把风格、节奏和分镜套路整理成一条可套用创意" },
  { icon: TrendingUp, text: "通过审核后进入创意中心,多一个展示和被精选的机会" },
  { icon: CheckCircle2, text: "原视频不会被改动,状态和使用次数可在「我发布的创意」查看" },
];

export function PublishCreativeCenterModal({
  title,
  publishing = false,
  onClose,
  onConfirm,
}: PublishCreativeCenterModalProps) {
  return (
    <ModalShell
      onClose={publishing ? () => {} : onClose}
      label={`发布到创意中心 · ${title}`}
      overlayZIndex={110}
      className="card pop-in col"
      style={{ width: 448, maxWidth: "94vw", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
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
            <div style={{ fontSize: 17, fontWeight: 800 }}>发布到创意中心</div>
            <div className="faint" style={{ marginTop: 2, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              让《{title}》的好点子出去露个脸
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
          我们会把这条成片整理成一条「可套用创意」,先提交运营审核。审核通过后,其他创作者就能在创意中心试试同款。
        </p>
        <div className="col gap-2" style={{ padding: "12px 13px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line-soft)" }}>
          {BENEFITS.map(({ icon: Icon, text }) => (
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
            先不发
          </button>
          <button type="button" className="btn btn-grad" onClick={onConfirm} disabled={publishing} aria-busy={publishing}>
            <Boxes size={15} /> {publishing ? "发布中..." : "确认发布"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
