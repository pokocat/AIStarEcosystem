"use client";

import { Plus } from "lucide-react";

/** 同城团购的图片添加引导；两类图片共用现有参考图数量，不另设必填条件。 */
export function SceneImageGuide({ max, disabled, onChoose }: { max: number; disabled: boolean; onChoose: (label: string) => void }) {
  return <div className="scene-image-guide" role="group" aria-label="图片上传建议">
    <p>建议添加产品实拍图和门店环境图，共可添加 {max} 张。</p>
    <div>{[{ label: "产品图片", note: "套餐、菜品或商品" }, { label: "环境图片", note: "门头、店内或用餐环境" }].map(item =>
      <button key={item.label} type="button" className="ip-brand-secondary" disabled={disabled} onClick={() => onChoose(item.label)} aria-label={`添加${item.label}`}>
        <Plus size={14}/><span><strong>{item.label}</strong><small>{item.note}</small></span>
      </button>)}</div>
  </div>;
}
