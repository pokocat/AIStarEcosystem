"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SelectField } from "@ai-star-eco/ui/ui/select-field";
import type { DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { costText, secRange, useBusy, dialogFocus } from "./director-shared";

export function SettingsPanel({ work, onClose, apply, setError }: { work: DirectorWork; onClose: () => void; apply: (w: DirectorWork) => void; setError: (m: string) => void }) {
  const [style, setStyle] = useState(work.settings.style);
  const [aspect, setAspect] = useState(work.settings.aspectRatio);
  const [videoModel, setVideoModel] = useState(work.settings.videoModel ?? "");
  const [imageModel, setImageModel] = useState(work.settings.imageModel ?? "");
  const imageModels = work.imageModels ?? [];
  const chosenImage = imageModels.find(m => imageModel ? m.id === imageModel : m.isDefault);
  const unavailableImage = !!imageModel && !imageModels.some(m => m.id === imageModel);
  const { busy, run } = useBusy();
  const save = () => void run("settings", async () => {
    apply(await DirectorApi.patchWork(work.id, { settings: { style: style.trim(), aspectRatio: aspect, videoModel: videoModel || null, imageModel: imageModel || null } }));
    onClose();
  }, setError);
  return <div className="director-popover" role="dialog" aria-label="作品设置" ref={dialogFocus} tabIndex={-1}>
    <header><h3>作品设置</h3><button type="button" aria-label="关闭" onClick={onClose}><X size={16}/></button></header>
    <label className="director-field"><span>画面风格</span><input value={style} maxLength={30} onChange={e => setStyle(e.target.value)}/></label>
    <div className="director-field"><span>画幅</span><div className="director-segmented">{(["9:16", "16:9", "1:1"] as const).map(a =>
      <button key={a} type="button" aria-pressed={aspect === a} onClick={() => setAspect(a)}>{a}</button>)}</div></div>
    <label className="director-field"><span>图片模型</span>
      <SelectField aria-label="图片模型" value={imageModel} disabled={!!busy} onChange={e => setImageModel(e.target.value)}>
        <option value="">默认{imageModels.find(m => m.isDefault) ? `（${imageModels.find(m => m.isDefault)!.name}）` : ""}</option>
        {unavailableImage && <option value={imageModel} disabled>原模型已不可用，请重新选择</option>}
        {imageModels.map(m => <option key={m.id} value={m.id}>{m.name} · {costText(m.creditCost, work.pricing.mock)}/张</option>)}
      </SelectField>
      <small>{unavailableImage ? "原图片模型暂不可用，请选择其他模型后保存。" : chosenImage
        ? `用于资产参考图和分镜图，${costText(chosenImage.creditCost, work.pricing.mock)}/张。`
        : "暂无可用图片模型，请联系管理员开通。"}</small>
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
    <footer><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button><button type="button" className="ip-brand-button" disabled={busy === "settings" || unavailableImage} onClick={save}>保存</button></footer>
  </div>;
}
