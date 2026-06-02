"use client";

// 出镜方式徽标 — 设计真源：components.jsx `EngineTag`。
// 文案护栏：UI 一律说"数字人出镜 / 特效镜·待开通"；engine 字段内部用 avatar | seedance，不进 UI 文案。
import * as React from "react";
import { Clock, Sparkles } from "lucide-react";

export type EngineKey = "avatar" | "seedance";

interface EngineTagProps {
  engine: EngineKey;
}

export function EngineTag({ engine }: EngineTagProps) {
  if (engine === "avatar") {
    return (
      <span className="tag tag-accent">
        <Sparkles size={11} fill="currentColor" strokeWidth={0} /> 数字人出镜
      </span>
    );
  }
  return (
    <span className="tag tag-amber">
      <Clock size={11} /> 特效镜 · 待开通
    </span>
  );
}
