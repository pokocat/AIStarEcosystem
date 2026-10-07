"use client";
import * as React from "react";
import { refreshImageUrl } from "./image-storage";
/** 图片加载失败时强制换签名；一次失败只续签一次，仍失败就给明确的重试入口。 */
export function SignedImage({ storageKey, src, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { storageKey?: string }) {
  const [url, setUrl] = React.useState(src);
  const [failed, setFailed] = React.useState(false);
  const renewed = React.useRef(false);
  const epoch = React.useRef(0);
  React.useEffect(() => { epoch.current++; setUrl(src); setFailed(false); renewed.current = false; }, [src, storageKey]);
  const renew = async () => {
    const current = epoch.current;
    if (!storageKey) { setFailed(true); return; }
    try { const next = await refreshImageUrl(storageKey); if (current === epoch.current) { setUrl(next); setFailed(false); } }
    catch { if (current === epoch.current) setFailed(true); }
  };
  if (failed) return <div className={props.className} style={{ ...props.style, display: "grid", placeItems: "center", minHeight: 80 }} role="status"><button type="button" style={{ pointerEvents: "auto", fontSize: 12 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void renew(); }}>图片加载失败 · 重新加载</button></div>;
  return <img {...props} src={url} onError={() => { if (renewed.current) { setFailed(true); return; } renewed.current = true; void renew(); }} />;
}
