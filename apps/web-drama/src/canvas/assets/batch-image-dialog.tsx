"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets/batch-image-dialog.tsx —— 列表「为选中的 N 个出图」的确认框（v0.198.1）。
//
// 不用全站的 dramaConfirm：那个挂在应用最外层（画布的 Provider 外面），价格是打开那一刻的定值；
// 这里要在框里换出图模型、总价跟着变，所以挂在画布里面，直接读 useCanvasPricing()。
// 换的是**整张画布的出图模型**（imageModelId，和出图面板、片段「出首帧」同一个选择），不是只管这一批。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Gem } from "lucide-react";
import { useCanvasPricing } from "@/canvas/core";
import { CvaModal, ModalHead } from "./inputs";

export interface BatchImageDialogProps {
  open: boolean;
  /** 这一批出几张（每项 1 张）。 */
  count: number;
  /** 选了但这次出不了的说明（planBatch 的 skippedText），没有就不传。 */
  skippedNote?: string | null;
  onCancel: () => void;
  /** 用户点了「确认生成」；发请求时读 useCanvasPricing().imageModelId（就是框里选的那个）。 */
  onConfirm: () => void;
}

export function BatchImageDialog({ open, count, skippedNote, onCancel, onConfirm }: BatchImageDialogProps) {
  const pricing = useCanvasPricing();
  const models = pricing.imageModels;
  const total = pricing.imagePrice(Math.max(1, count), pricing.imageModelId);
  const title = `为选中的 ${count} 个出图？`;
  return (
    <CvaModal open={open} onClose={onCancel} label={title} className="cva-batch-dialog">
      <ModalHead title={title} onClose={onCancel} />
      <p className="cva-batch-text">
        每个出 1 张，共 {count} 张。{skippedNote ?? ""}生成失败的那几张会退回积分。
      </p>
      <label className="cva-field cva-batch-model">
        <span className="cva-field-label">出图模型</span>
        <select
          className="cv-select"
          value={pricing.imageModelId ?? ""}
          disabled={models.length <= 1}
          onChange={(e) => pricing.setImageModelId(e.target.value)}
          aria-label="出图模型"
          data-action="batch-image-model"
        >
          {models.length === 0 && <option value="">默认模型</option>}
          {models.map((m) => (
            <option key={m.endpointId} value={m.endpointId}>
              {m.name}（每张 {m.creditCost} 积分）
            </option>
          ))}
        </select>
        <span className="cva-hint">换了之后，出图面板和片段「出首帧」也用这个模型。</span>
      </label>
      {pricing.ready ? (
        <div className="cva-batch-cost" data-cost={total}>
          <span>这次会用掉</span>
          <b className="cva-batch-cost-num">
            <Gem size={14} />
            <span className="num">{total}</span> 积分
          </b>
        </div>
      ) : (
        <div className="cva-hint">价格还没读到，按生成时的实际价格扣积分。</div>
      )}
      <div className="cva-modal-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="btn btn-grad btn-sm" onClick={onConfirm} data-action="confirm-batch-image">
          确认生成
        </button>
      </div>
    </CvaModal>
  );
}
