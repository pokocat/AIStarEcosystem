"use client";

import { useRef, useState } from "react";
import { Mic, Trash2, Upload, X } from "lucide-react";
import type { DirectorAsset, DirectorWork, DirectorAudioUpload } from "@ai-star-eco/types";
import type { StudioVoiceProfile } from "@ai-star-eco/types/ip-studio-workflow";
import { studioVoiceProfiles } from "@/canvas-bridge/studio-api";
import { DirectorApi } from "../api";
import { InlineError, errorText, useBusy, useEscape, dialogFocus } from "./director-shared";

/** 资产卡里的音色摘要：说清现在是参考音频、文字描述还是都没有，点「设置音色」打开单独的配置弹窗。 */
export function VoicePanel({ work, asset, apply }: { work: DirectorWork; asset: DirectorAsset; apply: (w: DirectorWork) => void }) {
  const [open, setOpen] = useState(false);
  const voice = asset.voice;
  const desc = asset.voiceDesc?.trim();
  return <section className="director-sheet-section director-voice" aria-label="角色音色">
    <h5>角色音色{voice || desc ? <em>已设置</em> : <em className="is-muted">未设置</em>}</h5>
    {voice || desc ? <small>{voice ? `参考音频：${voice.name}${voice.durationSec ? ` · ${Math.round(voice.durationSec * 10) / 10} 秒` : ""}` : "没有参考音频"}{desc ? ` · 描述：${desc}` : ""}</small>
      : <small>还没设置。不设置时按人物身份自然配音，各片段的声音可能不一样。</small>}
    <div className="director-card-actions"><button type="button" className="ip-brand-secondary" onClick={() => setOpen(true)}><Mic size={14}/>{voice || desc ? "修改音色" : "设置音色"}</button></div>
    {open && <VoiceDialog work={work} asset={asset} apply={apply} onClose={() => setOpen(false)}/>}
  </section>;
}

type Pending = { kind: "file"; file: File; uploaded?: DirectorAudioUpload } | { kind: "library"; profile: StudioVoiceProfile } | { kind: "remove" } | null;

/** 角色音色单独配置：用文字描述，或上传 / 从声音库选一段参考音频；两者可以都有。保存时一起生效。 */
export function VoiceDialog({ work, asset, apply, onClose }: { work: DirectorWork; asset: DirectorAsset; apply: (w: DirectorWork) => void; onClose: () => void }) {
  const [desc, setDesc] = useState(asset.voiceDesc ?? "");
  // 打开弹窗时的版本号：描述按它提交，别处改过就照常 409，不悄悄覆盖。
  const savedDescription = useRef({ rev: asset.rev, text: asset.voiceDesc?.trim() ?? "" });
  const [pending, setPending] = useState<Pending>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const { busy, run } = useBusy();
  const file = useRef<HTMLInputElement>(null);
  useEscape(() => { if (!busy && !picking) onClose(); });
  const current = pending?.kind === "remove" ? null : asset.voice;
  const descChanged = desc.trim() !== savedDescription.current.text;
  const dirty = descChanged || !!pending;
  const save = () => void run("save", async () => {
    let w = work;
    // 先存描述（带打开时的版本号），再换音频：音频绑定会把版本号往前推，顺序反过来就检测不到冲突。
    if (descChanged) {
      w = await DirectorApi.edit(work.id, "asset.update", asset.id, savedDescription.current.rev, { voiceDesc: desc.trim() });
      savedDescription.current = { text: desc.trim(), rev: w.assets.find(a => a.id === asset.id)?.rev ?? savedDescription.current.rev };
      apply(w); // Keep a successful description save if the following upload/binding fails.
    }
    if (pending?.kind === "file") {
      const result = pending.uploaded ?? await DirectorApi.uploadAudio(work.id, pending.file);
      setPending({ ...pending, uploaded: result }); // A supplier failure retries binding with the same owned sample.
      w = await DirectorApi.edit(work.id, "asset.setVoice", asset.id, null, { key: result.key, name: pending.file.name.replace(/\.[^.]+$/, "") || "声音样本", source: "upload", durationSec: result.durationSec });
    } else if (pending?.kind === "library") {
      w = await DirectorApi.edit(work.id, "asset.setVoice", asset.id, null, { key: pending.profile.demoStorageKey, name: `${pending.profile.name} v${pending.profile.version}`, source: "library", voiceId: pending.profile.voiceId });
    } else if (pending?.kind === "remove") {
      w = await DirectorApi.edit(work.id, "asset.clearVoice", asset.id, null);
    }
    apply(w);
    onClose();
  }, setError);
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog director-voice-dialog" role="dialog" aria-modal="true" aria-labelledby="director-voice-dialog-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-voice-dialog-title">角色音色</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={!!busy}><X size={18}/></button></header>
      <div className="director-field"><span>角色</span><p className="director-voice-name">{asset.name}</p></div>
      <label className="director-field"><span>音色描述</span>
        <textarea rows={3} maxLength={200} value={desc} onChange={e => setDesc(e.target.value)} placeholder="例如：女声，青年音色，语调中偏低，温柔清晰"/>
        <small>没有参考音频时，视频按这段描述配音；有参考音频时作为补充。</small>
      </label>
      <div className="director-field"><span>参考音频（选填）</span>
        {pending?.kind === "file" ? <div className="director-voice-current"><b>待上传：{pending.file.name}</b><button type="button" className="ip-brand-text-button" onClick={() => setPending(null)}>撤销</button></div>
          : pending?.kind === "library" ? <div className="director-voice-current"><b>待使用：{pending.profile.name} v{pending.profile.version}</b>{pending.profile.demoUrl && <audio controls preload="none" src={pending.profile.demoUrl}/>}<button type="button" className="ip-brand-text-button" onClick={() => setPending(null)}>撤销</button></div>
          : current ? <div className="director-voice-current"><b>{current.name}{current.durationSec ? ` · ${Math.round(current.durationSec * 10) / 10} 秒` : ""}{current.source === "library" ? " · 声音库" : " · 上传"}</b>
            {current.url && <audio controls preload="none" src={current.url} aria-label={`${asset.name}的声音样本`}/>}
            <button type="button" className="ip-brand-text-button director-danger" onClick={() => setPending({ kind: "remove" })}><Trash2 size={13}/>移除</button></div>
          : <button type="button" className="director-voice-drop" onClick={() => file.current?.click()}>
            <Upload size={18}/><b>上传音频</b><span>MP3、WAV 或 M4A，2–15 秒、最多 15 MB；建议单人说话、没有背景音乐</span></button>}
        {pending?.kind === "remove" && <small className="director-danger">保存后移除参考音频。<button type="button" className="ip-brand-text-button" onClick={() => setPending(null)}>撤销</button></small>}
        <div className="director-card-actions">
          {(current || pending) && pending?.kind !== "remove" && <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => file.current?.click()}><Upload size={14}/>换一段</button>}
          <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => setPicking(true)}>从声音库选择</button>
        </div>
        <small>保存后，支持声音参考的视频模型会自动引用该角色的声音样本。</small>
        <input ref={file} type="file" disabled={!!busy} accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPending({ kind: "file", file: f }); }}/>
      </div>
      <InlineError message={error}/>
      <footer><button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy || !dirty} onClick={save}>{busy ? "保存中" : "保存音色"}</button></footer>
    </div>
    {picking && <VoiceLibrary onClose={() => setPicking(false)} onPick={p => { setPending({ kind: "library", profile: p }); setPicking(false); }}/>}
  </div>;
}

function VoiceLibrary({ onClose, onPick }: { onClose: () => void; onPick: (p: StudioVoiceProfile) => void }) {
  useEscape(onClose);
  const [profiles, setProfiles] = useState<StudioVoiceProfile[]>();
  const [error, setError] = useState("");
  const loaded = useRef(false);
  if (!loaded.current) {
    loaded.current = true;
    void studioVoiceProfiles().then(c => setProfiles(c.profiles.filter(p => p.demoStorageKey))).catch(e => setError(errorText(e)));
  }
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-dialog" role="dialog" aria-modal="true" aria-labelledby="director-voice-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-voice-title">选择声音</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18}/></button></header>
      <p className="director-dialog-note">Studio 中已保存的人物声音，将以试听音频作为参考。</p>
      <InlineError message={error}/>
      {!profiles && !error && <p className="director-dialog-note">加载中…</p>}
      {profiles && profiles.length === 0 && <p className="director-dialog-note">暂无已保存的人物声音，可直接上传声音样本。</p>}
      {profiles && profiles.length > 0 && <ul className="director-voice-list">{profiles.map(p => <li key={p.voiceId}>
        <div><strong>{p.name} v{p.version}</strong>{p.instruct && <small>{p.instruct}</small>}</div>
        {p.demoUrl && <audio controls preload="none" src={p.demoUrl}/>}
        <button type="button" className="ip-brand-secondary" onClick={() => onPick(p)}>选择</button>
      </li>)}</ul>}
    </div>
  </div>;
}
