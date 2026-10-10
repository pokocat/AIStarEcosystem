"use client";
import * as React from "react";
import { refreshImageUrl } from "./image-storage";

/** Storage keys remain authoritative when a long editing session outlives its signed URL. */
export function SignedVideo({ storageKey, src, ...props }: React.VideoHTMLAttributes<HTMLVideoElement> & { storageKey?: string }) {
  const [url, setUrl] = React.useState(src);
  const [failed, setFailed] = React.useState(false);
  const [reloadKey,setReloadKey] = React.useState(0);
  const renewed = React.useRef(false);
  const epoch = React.useRef(0);
  React.useEffect(() => { epoch.current++; setUrl(src); setFailed(false); renewed.current = false; }, [src, storageKey]);
  const renew = async () => {
    const current = epoch.current;
    if (!storageKey) { setFailed(true); return; }
    try { const next = await refreshImageUrl(storageKey); if (current === epoch.current) { setUrl(next); setFailed(false); setReloadKey(key=>key+1); } }
    catch { if (current === epoch.current) setFailed(true); }
  };
  if (failed) return <div role="status"><button type="button" onClick={() => void renew()}>视频加载失败 · 重新加载</button></div>;
  // Local or still-valid signatures may return the same URL; remount to retry the media load once.
  return <video key={reloadKey} {...props} src={url} onError={() => { if (renewed.current) { setFailed(true); return; } renewed.current = true; void renew(); }} />;
}
