"use client";
import { reportStudioError } from '@/ip/studio-errors';
import * as React from "react";
import { refreshImageUrl } from "./image-storage";

/** Renew from an owned storage key when the audio URL expires in a long canvas session. */
export function SignedAudio({ storageKey, src, ...props }: React.ComponentProps<"audio"> & { storageKey?: string }) {
  const [url, setUrl] = React.useState(src), [failed, setFailed] = React.useState(false);
  const [reloadKey,setReloadKey] = React.useState(0);
  const renewed = React.useRef(false), epoch = React.useRef(0);
  React.useEffect(() => { epoch.current++; setUrl(src); setFailed(false); renewed.current = false; }, [src, storageKey]);
  const renew = async () => {
    const current = epoch.current;
    if (!storageKey) { setFailed(true); reportStudioError({code:'MEDIA_LOAD_FAILED',message:'音频未能加载，请重新选择素材'}, {once:`media:${src}`}); return; }
    try { const next = await refreshImageUrl(storageKey); if (current === epoch.current) { setUrl(next); setFailed(false); setReloadKey(key=>key+1); } }
    catch (error) { if (current === epoch.current) { setFailed(true); reportStudioError(error, { once: `media:${storageKey}`, fallback: '音频重新加载失败，请重试' }); } }
  };
  // A node restored from a finished run carries only its key (URLs expire, so events never store one): sign it here, as
  // SignedImage does. Without this a video the assistant made while the canvas was closed showed as an empty upload card
  // until a reload (Codex retest 2026-10-19, R1).
  React.useEffect(() => { if (!src && storageKey) void renew(); }, [src, storageKey]);
  if (failed) return <div role="status"><button type="button" className="nodrag nopan" onClick={() => void renew()}>音频加载失败 · 重新加载</button></div>;
  return <audio key={reloadKey} {...props} preload="metadata" src={url} onError={() => { if (renewed.current) { setFailed(true); reportStudioError({code:'MEDIA_LOAD_FAILED',message:'音频未能加载，请重新选择素材'}, {once:`media:${storageKey || src}`}); return; } renewed.current = true; void renew(); }} />;
}
