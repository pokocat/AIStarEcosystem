"use client";

import { useRef, useState } from "react";
import { Mic, Trash2, Upload, X } from "lucide-react";
import type { DirectorAsset, DirectorWork } from "@ai-star-eco/types";
import type { StudioVoiceProfile } from "@ai-star-eco/types/ip-studio-workflow";
import { studioVoiceProfiles } from "@/canvas-bridge/studio-api";
import { DirectorApi } from "../api";
import { InlineError, errorText, useBusy, useEscape } from "./director-shared";

/**
 * 角色的声音参考。出片段视频时把这段真实音频交给视频模型做音色参考；
 * 没绑也能出视频，只是跨片段音色不保证 —— 界面照实说，不说成「声音已固定」。
 */
export function VoicePanel({ work, asset, apply }: { work: DirectorWork; asset: DirectorAsset; apply: (w: DirectorWork) => void }) {
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const { busy, run } = useBusy();
  const file = useRef<HTMLInputElement>(null);
  const voice = asset.voice;
  const upload = (f: File) => void run("upload", async () => {
    const result = await DirectorApi.uploadAudio(work.id, f);
    apply(await DirectorApi.edit(work.id, "asset.setVoice", asset.id, null, { key: result.key, name: f.name.replace(/\.[^.]+$/, "") || "声音样本", source: "upload", durationSec: result.durationSec }));
  }, setError);
  const clear = () => void run("clear", async () => apply(await DirectorApi.edit(work.id, "asset.clearVoice", asset.id, null)), setError);
  return <div className="director-voice">
    <div className="director-voice-head"><Mic size={14}/><span>声音参考</span>{voice ? <em>已绑定</em> : <em className="is-muted">未绑定</em>}</div>
    {voice ? <>
      {voice.url && <audio controls preload="none" src={voice.url} aria-label={`${asset.name}的声音样本`}/>}
      <small>{voice.name}{voice.durationSec ? ` · ${Math.round(voice.durationSec * 10) / 10} 秒` : ""}{voice.source === "library" ? " · 声音库" : " · 上传"}</small>
    </> : <small>用于片段视频的音色参考。建议 3–10 秒单人语音，无背景音乐。未绑定也可生成，但各片段音色可能不一致。</small>}
    <div className="director-card-actions">
      <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => file.current?.click()}><Upload size={14}/>{voice ? "更换" : "上传声音"}</button>
      <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => setPicking(true)}>从声音库选择</button>
      {voice && <button type="button" className="ip-brand-text-button director-danger" disabled={!!busy} onClick={clear} aria-label="移除声音参考"><Trash2 size={14}/></button>}
      <input ref={file} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}/>
    </div>
    <InlineError message={error} onClose={() => setError("")}/>
    {picking && <VoiceLibrary onClose={() => setPicking(false)} onPick={p => void run("pick", async () => {
      apply(await DirectorApi.edit(work.id, "asset.setVoice", asset.id, null, { key: p.demoStorageKey, name: `${p.name} v${p.version}`, source: "library", voiceId: p.voiceId }));
      setPicking(false);
    }, setError)}/>}
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
    <div className="director-dialog" role="dialog" aria-modal="true" aria-labelledby="director-voice-title">
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
