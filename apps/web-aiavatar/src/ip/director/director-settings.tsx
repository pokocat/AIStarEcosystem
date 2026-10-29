"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SelectField } from "@ai-star-eco/ui/ui/select-field";
import type { DirectorImageModelState, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { InlineError, costText, secRange, useBusy, dialogFocus, type DirectorFail } from "./director-shared";

export function SettingsPanel({ work, onClose, apply, setError }: { work: DirectorWork; onClose: () => void; apply: (w: DirectorWork) => void; setError: DirectorFail }) {
  const [style, setStyle] = useState(work.settings.style);
  const [localError, setLocalError] = useState("");
  const [aspect, setAspect] = useState(work.settings.aspectRatio);
  const [videoModel, setVideoModel] = useState(work.settings.videoModel ?? "");
  const savedText = work.settings.textModel ?? "";
  const [textModel, setTextModel] = useState(savedText);
  const textModels = work.textModels ?? [];
  const unavailableText = !!textModel && !textModels.some(m => m.endpointId === textModel);
  const savedImage = work.settings.imageModel ?? "";
  const [imageModel, setImageModel] = useState(savedImage);
  const imageModels = work.imageModels ?? [];
  const chosenImage = imageModels.find(m => imageModel ? m.id === imageModel : m.isDefault);
  // 存着的旧选择不在可选列表里（停用了，或出不全三种比例）：照样显示，其他设置照常能存，换不换由用户定。
  const unavailableImage = !!imageModel && !imageModels.some(m => m.id === imageModel);
  const state = work.imageModelState;
  // 说明的是「这次保存后实际会用的模型」：还停在原选择上（含跟默认走），服务端给的状况才对得上。
  const stateNote = imageModel === savedImage && state ? imageStateNote(state, aspect, work.pricing.mock) : null;
  const { busy, run } = useBusy();
  const save = () => void run("settings", async () => {
    // 图片模型没改就不带：原值不重新提交，另一个页面刚换过的模型也不会被这里改回去。
    const imageChange = imageModel === savedImage ? {} : { imageModel: imageModel || null };
    const textChange = textModel === savedText ? {} : { textModel: textModel || null };
    apply(await DirectorApi.patchWork(work.id, { settings: { style: style.trim(), aspectRatio: aspect, videoModel: videoModel || null, ...textChange, ...imageChange } }));
    onClose();
  }, message => setLocalError(`设置没有保存：${message}。改动还在，调整后再点「保存」。`));
  return <div className="director-popover" role="dialog" aria-label="作品设置" ref={dialogFocus} tabIndex={-1}>
    <header><h3>作品设置</h3><button type="button" aria-label="关闭" onClick={onClose}><X size={16}/></button></header>
    <label className="director-field"><span>画面风格</span><input value={style} maxLength={30} onChange={e => setStyle(e.target.value)}/></label>
    <div className="director-field"><span>画幅</span><div className="director-segmented">{(["9:16", "16:9", "1:1"] as const).map(a =>
      <button key={a} type="button" aria-pressed={aspect === a} onClick={() => setAspect(a)}>{a}</button>)}</div></div>
    <label className="director-field"><span>文本模型</span>
      <SelectField aria-label="文本模型" value={textModel} disabled={!!busy || work.textModelMode === "fixed" || !textModels.length} onChange={e => setTextModel(e.target.value)}>
        <option value="">默认{textModels.find(m => m.isDefault) ? `（${textModels.find(m => m.isDefault)!.name}）` : ""}</option>
        {unavailableText && <option value={textModel} disabled>原模型已不可用</option>}
        {textModels.map(m => <option key={m.endpointId} value={m.endpointId} disabled={!work.pricing.mock && !m.tokenPricing}>{m.name}{!work.pricing.mock && !m.tokenPricing ? " · 暂不可用" : ""}</option>)}
      </SelectField>
      <small>{unavailableText ? "原文本模型不在可选范围内，换一个模型才能继续写剧本和分镜。其他设置可以照常保存。"
        : !textModels.length ? "暂无可用文本模型，请联系管理员开通。"
        : `用于剧本、拆分集、提取资产和分镜脚本，${work.pricing.mock ? "测试模式，免费。" : "按实际用量结算。"}`}</small>
    </label>
    <label className="director-field"><span>图片模型</span>
      <SelectField aria-label="图片模型" value={imageModel} disabled={!!busy} onChange={e => setImageModel(e.target.value)}>
        <option value="">默认{imageModels.find(m => m.isDefault) ? `（${imageModels.find(m => m.isDefault)!.name}）` : ""}</option>
        {unavailableImage && <option value={imageModel} disabled>{state?.explicit && state.available && state.name ? `${state.name}（原选择）` : "原模型已不可用"}</option>}
        {imageModels.map(m => <option key={m.id} value={m.id}>{m.name} · {costText(m.creditCost, work.pricing.mock)}/张</option>)}
      </SelectField>
      <small>{stateNote ?? (unavailableImage ? "原图片模型不在可选范围内，换一个模型才能继续出图。其他设置可以照常保存。" : chosenImage
        ? `用于资产图和分镜图，${costText(chosenImage.creditCost, work.pricing.mock)}/张。`
        : "暂无可用图片模型，请联系管理员开通。")}</small>
    </label>
    <label className="director-field"><span>视频模型</span>
      <SelectField value={videoModel} onChange={e => setVideoModel(e.target.value)}>
        <option value="">默认{work.videoModels.find(m => m.isDefault) ? `（${work.videoModels.find(m => m.isDefault)!.name}）` : ""}</option>
        {work.videoModels.map(m => <option key={m.id} value={m.id}>{m.name} · {secRange(m.minSec, m.maxSec)}{m.mode === "frame" ? " · 仅分镜首帧" : ""}</option>)}
      </SelectField>
      <small>{!work.videoModels.length ? "暂无可用视频模型，无法确定片段时长。请联系管理员开通。"
        : work.videoModels.find(m => m.id === videoModel || (!videoModel && m.isDefault))?.mode === "frame"
          ? "仅使用分镜首帧，不支持额外图片或声音参考。多镜头片段请先拆分。"
          : "同时参考分镜图、角色 / 场景 / 道具图和角色声音。片段时长按模型支持的范围来定。"}</small>
    </label>
    <p className="director-dialog-note">修改仅影响之后生成的内容，已生成的内容不变。</p>
    <InlineError message={localError} onClose={() => setLocalError("")}/>
    <footer><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button><button type="button" className="ip-brand-button" disabled={busy === "settings"} onClick={save}>保存</button></footer>
  </div>;
}

const RATIO_NAMES: Record<string, string> = { "1:1": "方图", "16:9": "横图", "9:16": "竖图" };

/**
 * 原选择（或默认模型）有问题时的说明；没问题返回 null，照常显示价格。
 * 道具用方图、角色和场景用横图、分镜跟作品画幅，缺哪种就说哪类出不了。
 */
function imageStateNote(state: DirectorImageModelState, aspect: string, mock: boolean): string | null {
  const who = state.explicit ? "原图片模型" : "默认图片模型";
  if (!state.available) return state.explicit
    ? "原图片模型已停用，资产图和分镜图暂时生成不了，换一个模型才能继续出图。其他设置可以照常保存。"
    : "默认图片模型暂不可用，请选择一个图片模型，或联系管理员。";
  if (!state.missingRatios.length) return null;
  const affected: string[] = [];
  if (state.missingRatios.includes("16:9")) affected.push("角色", "场景");
  if (state.missingRatios.includes("1:1")) affected.push("道具");
  if (state.missingRatios.includes(aspect)) affected.push("分镜");
  const name = state.name ? `「${state.name}」` : "";
  const missing = state.missingRatios.map(r => RATIO_NAMES[r] ?? r).join("、");
  const price = state.creditCost == null ? "" : `，${costText(state.creditCost, mock)}/张`;
  return affected.length
    ? `${who}${name}不能出${missing}，${affected.join("、")}的图生成不了；其他画面照常${price}。换一个模型才能出全部画面，不换也可以保存其他设置。`
    : `${who}${name}不能出${missing}，当前画幅下不影响出图${price}。`;
}
