"use client";

// 引擎限制内联校验 — 设计真源:screens-board.jsx `EngineLimits`。
// 数字人:免检 + accent-soft 说明卡;特效镜:文件/时长 4 项 + 进度条 + 超限红警。
import * as React from "react";
import { Check, Sparkles, TriangleAlert } from "lucide-react";
import type { BoardShot } from "@/mocks/drama-workshop";

interface EngineLimitsProps {
  shot: BoardShot;
}

export function EngineLimits({ shot }: EngineLimitsProps) {
  if (shot.engine === "avatar") {
    return (
      <div
        className="card row gap-3"
        style={{ padding: 12, background: "var(--accent-soft)", border: "none" }}
      >
        <Sparkles
          size={16}
          fill="currentColor"
          strokeWidth={0}
          style={{ color: "var(--accent)", flex: "none", marginTop: 1 }}
        />
        <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
          由<b style={{ color: "var(--accent)" }}>数字人引擎</b>承接真人脸,按其自身能力运作,没有特效镜的文件 / 时长限制。
        </div>
      </div>
    );
  }
  const img = shot.cast.length + (shot.refImg ?? 0);
  const vid = shot.overLimit ? 2 : 0;
  const aud = shot.voice ? 1 : 0;
  const dur = shot.overLimit ? 18 : 8;
  const rows: { label: string; cur: number; max: number; unit?: string }[] = [
    { label: "图片参考", cur: img, max: 9 },
    { label: "视频参考", cur: vid, max: 3 },
    { label: "音频参考", cur: aud, max: 3 },
    { label: "参考总时长", cur: dur, max: 15, unit: "s" },
  ];
  const totalFiles = img + vid + aud;
  const anyOver = rows.some((r) => r.cur > r.max) || totalFiles > 12;
  return (
    <div
      className="card col gap-2"
      style={{
        padding: 12,
        border: anyOver ? "1px solid #fecaca" : "1px solid var(--line-soft)",
        background: anyOver ? "#fef2f2" : "var(--surface-2)",
      }}
    >
      <div
        className="row gap-2"
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: anyOver ? "#b91c1c" : "var(--ink-2)",
        }}
      >
        {anyOver ? <TriangleAlert size={13} /> : <Check size={13} />}
        特效镜参考素材限制 {anyOver ? "· 已超限" : "· 符合"}
        <span className="grow" />
        <span className="num faint" style={{ fontWeight: 600 }}>
          文件 {totalFiles}/12
        </span>
      </div>
      {rows.map((r) => {
        const over = r.cur > r.max;
        return (
          <div key={r.label} className="row gap-2" style={{ fontSize: 12 }}>
            <span style={{ width: 72, color: "var(--ink-2)" }}>{r.label}</span>
            <div
              className="grow"
              style={{
                height: 6,
                borderRadius: 99,
                background: "var(--line)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: Math.min(100, (r.cur / r.max) * 100) + "%",
                  background: over ? "#dc2626" : "var(--accent)",
                  borderRadius: 99,
                }}
              />
            </div>
            <span
              className="num"
              style={{
                width: 56,
                textAlign: "right",
                fontWeight: 700,
                color: over ? "#dc2626" : "var(--ink-2)",
              }}
            >
              {r.cur}/{r.max}
              {r.unit ?? ""}
            </span>
          </div>
        );
      })}
      {anyOver && (
        <div style={{ fontSize: 11.5, color: "#b91c1c" }}>
          缩短参考素材时长,或把这一镜拆成两镜。视频参考更耗额度。
        </div>
      )}
    </div>
  );
}
