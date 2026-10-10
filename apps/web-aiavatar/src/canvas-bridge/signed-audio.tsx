"use client";
import * as React from "react";
import { refreshImageUrl } from "./image-storage";

/** Renew from an owned storage key when the audio URL expires in a long canvas session. */
export function SignedAudio({ storageKey, src, ...props }: React.AudioHTMLAttributes<HTMLAudioElement> & { storageKey?: string }) {
  const [url, setUrl] = React.useState(src), [failed, setFailed] = React.useState(false);
  const [reloadKey,setReloadKey] = React.useState(0);
  const renewed = React.useRef(false), epoch = React.useRef(0);
  React.useEffect(() => { epoch.current++; setUrl(src); setFailed(false); renewed.current = false; }, [src, storageKey]);
  const renew = async () => {
    const current = epoch.current;
    if (!storageKey) { setFailed(true); return; }
    try { const next = await refreshImageUrl(storageKey); if (current === epoch.current) { setUrl(next); setFailed(false); setReloadKey(key=>key+1); } }
    catch { if (current === epoch.current) setFailed(true); }
  };
  if (failed) return <div role="status"><button type="button" onClick={() => void renew()}>音频加载失败 · 重新加载</button></div>;
  return <audio key={reloadKey} {...props} preload="metadata" src={url} onError={() => { if (renewed.current) { setFailed(true); return; } renewed.current = true; void renew(); }} />;
}
