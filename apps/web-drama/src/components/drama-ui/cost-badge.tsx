"use client";

// 积分徽标 — 沿用设计真源 .cost 类（components.jsx `Cost`）。
import * as React from "react";
import { Zap } from "lucide-react";

interface CostProps {
  n: number;
  prefix?: string;
  /** 单位文案，默认 "积分" */
  unit?: string;
}

export function Cost({ n, prefix = "约消耗", unit = "积分" }: CostProps) {
  return (
    <span className="cost">
      <Zap size={13} /> {prefix} <b className="num">{n}</b> {unit}
    </span>
  );
}
