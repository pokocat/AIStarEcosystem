"use client";

// 画布里卡片要调的动作（打开造型详情、加造型、收起分组、删除、改文字…）。
// 由 BoardView 提供，函数引用稳定（内部走 ref），只有 readOnly 变了才换值 —— 上百张卡片不会因为它跟着重画。
import * as React from "react";
import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";

export type RenameTarget = { kind: "character" | "scene" | "material"; id: string };

export interface BoardActions {
  /** 只读（别处改过 / 打不开）或抓手模式：卡片上不给编辑按钮。 */
  readOnly: boolean;
  getDoc: () => DramaCanvasDoc;
  openLookDetail: (lookId: string) => void;
  addLookTo: (characterId: string) => void;
  addScene: () => void;
  toggleCollapsed: (groupId: string) => void;
  requestDelete: (nodeId: string) => void;
  setMaterialText: (materialId: string, text: string) => void;
  rename: (target: RenameTarget, name: string) => void;
  select: (nodeId: string) => void;
}

const BoardActionsContext = React.createContext<BoardActions | null>(null);

export function BoardActionsProvider({ value, children }: { value: BoardActions; children: React.ReactNode }) {
  return <BoardActionsContext.Provider value={value}>{children}</BoardActionsContext.Provider>;
}

export function useBoardActions(): BoardActions {
  const v = React.useContext(BoardActionsContext);
  if (!v) throw new Error("useBoardActions 只能在 BoardView 里面用");
  return v;
}
