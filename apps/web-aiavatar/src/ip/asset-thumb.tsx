"use client";
// 资产页和资产选择框里的缩略图（2026-10-31）。和 SignedImage / SignedVideo 一样，签名过期时按 key 换一次新地址；
// 不同的是：仍然读不到就安静地显示一个占位，不弹错误、不放「重新加载」按钮。
// 一页几十张卡，坏一张就弹一次错误框没法用；卡片本身又是按钮，里面不能再套按钮。点开预览时仍走 Signed* 那套，失败会说明原因。
import { useEffect, useRef, useState } from 'react';
import { Film, ImageOff } from 'lucide-react';
import { refreshImageUrl } from '@/canvas-bridge/image-storage';

export function AssetThumb({ kind, src, storageKey }: { kind: 'image' | 'video'; src?: string; storageKey?: string }) {
  const [url, setUrl] = useState(src);
  const [failed, setFailed] = useState(false);
  const renewed = useRef(false);
  const current = useRef(src);
  // 换来的地址和原来一样（本地假 CDN 不签名）就不会重新加载，直接算读不到。
  const renew = (key: string) => refreshImageUrl(key).then(next => {
    if (!next || next === current.current) { setFailed(true); return; }
    current.current = next; setUrl(next);
  }).catch(() => setFailed(true));
  useEffect(() => {
    current.current = src; setUrl(src); setFailed(false); renewed.current = false;
    // 只给了 key（没有签好的地址）：先签一个。
    if (!src && storageKey) { renewed.current = true; void renew(storageKey); }
    // renew 只读 ref 和 setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, storageKey]);
  const onError = () => {
    if (renewed.current || !storageKey) { setFailed(true); return; }
    renewed.current = true;
    void renew(storageKey);
  };
  if (failed || (!url && !storageKey)) return <span className="asset-thumb-missing" role="img" aria-label={kind === 'video' ? '视频暂时读不到' : '图片暂时读不到'}>{kind === 'video' ? <Film size={26} strokeWidth={1.3}/> : <ImageOff size={26} strokeWidth={1.3}/>}</span>;
  if (!url) return <span className="asset-thumb-missing" aria-hidden="true"/>;
  return kind === 'video'
    ? <video src={url} muted playsInline preload="metadata" onError={onError}/>
    : <img src={url} alt="" loading="lazy" onError={onError}/>;
}
