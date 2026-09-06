"use client";

// 画布工作栏 —— 返回 / 项目名就地改 / 保存状态 / 积分余额 / 撤销重做 /
// 运行全部生成 / 发布。

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, Cloud, CloudOff, Coins, Loader2, Redo2, Send, Undo2, Wand2,
} from "lucide-react";
import type { SaveState } from "@/lib/canvas-store";

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--ink-3)" }}>
        <Loader2 className="w-3 h-3 animate-spin" /> 保存中
      </span>
    );
  }
  if (state === "error") {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-[11px] font-semibold"
        style={{ color: "var(--err)" }}
      >
        <CloudOff className="w-3 h-3" /> 没保存上，点这里重试
      </button>
    );
  }
  if (state === "dirty") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--ink-3)" }}>
        <Cloud className="w-3 h-3" /> 编辑中
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--ok)" }}>
        <Check className="w-3 h-3" /> 已自动保存
      </span>
    );
  }
  return null;
}

export interface CanvasTopBarProps {
  name: string;
  onNameChange: (name: string) => void;
  saveState: SaveState;
  onRetrySave: () => void;
  credits: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRunAll: () => void;
  runAllBusy: boolean;
  onPublish: () => void;
  published: boolean;
}

export function CanvasTopBar({
  name, onNameChange, saveState, onRetrySave, credits, canUndo, canRedo,
  onUndo, onRedo, onRunAll, runAllBusy, onPublish, published,
}: CanvasTopBarProps) {
  return (
    <div
      className="shrink-0 flex items-center gap-3 px-3.5 h-[52px]"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
    >
      <Link
        href="/projects"
        className="shrink-0 p-1.5 rounded-lg transition hover:bg-[var(--surface-2)]"
        title="回到项目列表"
        aria-label="回到项目列表"
      >
        <ArrowLeft className="w-4 h-4" style={{ color: "var(--ink-2)" }} />
      </Link>

      <div className="min-w-0 flex-1 flex items-center gap-2.5">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="未命名 IP 项目"
          aria-label="项目名"
          className="asset-name text-[17px] bg-transparent outline-none min-w-0 w-full max-w-[18rem] px-1.5 py-1 rounded-lg transition hover:bg-[var(--surface-2)] focus:bg-[var(--surface-2)]"
          style={{ color: "var(--ink)" }}
        />
        <span className="shrink-0"><SaveIndicator state={saveState} onRetry={onRetrySave} /></span>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        {credits !== null && (
          <span
            className="hidden md:inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[11.5px] font-semibold tabular"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
            title="当前积分余额"
          >
            <Coins className="w-3.5 h-3.5" style={{ color: "var(--ink-3)" }} />
            {credits.toLocaleString("zh-CN")}
          </span>
        )}

        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--line-2)" }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-8 h-8 flex items-center justify-center transition hover:bg-[var(--surface-2)] disabled:opacity-35"
            title="撤销（⌘Z）"
            aria-label="撤销"
          >
            <Undo2 className="w-3.5 h-3.5" style={{ color: "var(--ink-2)" }} />
          </button>
          <span aria-hidden className="w-px h-4" style={{ background: "var(--line-2)" }} />
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-8 h-8 flex items-center justify-center transition hover:bg-[var(--surface-2)] disabled:opacity-35"
            title="重做（⇧⌘Z）"
            aria-label="重做"
          >
            <Redo2 className="w-3.5 h-3.5" style={{ color: "var(--ink-2)" }} />
          </button>
        </div>

        <button
          onClick={onRunAll}
          disabled={runAllBusy}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-bold transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          style={{ border: "1px solid var(--line-2)", color: "var(--ink)" }}
        >
          {runAllBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">运行全部生成</span>
        </button>

        <button
          onClick={onPublish}
          disabled={published}
          className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12px] font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          title={published ? "这个项目已经发布过了" : "发布到数字资产库"}
        >
          <Send className="w-3.5 h-3.5" />
          {published ? "已发布" : "发布"}
        </button>
      </div>
    </div>
  );
}
