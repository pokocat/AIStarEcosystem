"use client";
// 资产页图片右下角的认证盾牌（2026-11-14）。两种来源合成一个标记：
// 1. 这张图已通过审核、存进了火山官方素材库（服务端人像记录 status=active，按图片 storageKey 对上），之后用它生成视频不再弹人像确认；
// 2. 「人物」卡片上的数字人做过七牛刷脸认证（旧链路，调用方传 faceVerified）。七牛不再接入，等它下线后只剩第 1 种。
// 一页几十张卡共用一次请求，30 秒内不重复拉；读不到就不显示标记，不弹错误（它只是附加信息）。
import { useEffect, useSyncExternalStore } from 'react';
import { Tooltip } from 'antd';
import { ShieldCheck } from 'lucide-react';
import type { VideoPortraitVerified } from '@ai-star-eco/types/video-portrait-library';
import { verifiedPortraits } from './api/video-portrait-library';
import { studioOverlayContainer } from './studio-overlay';

type Placement = VideoPortraitVerified['placement'];
let verified = new Map<string, Placement>();
let loadedAt = 0;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const FRESH_MS = 30_000;

function load() {
  if (loading || (loadedAt && Date.now() - loadedAt < FRESH_MS)) return;
  loading = verifiedPortraits()
    .then(list => { verified = new Map(list.map(v => [v.key, v.placement])); loadedAt = Date.now(); listeners.forEach(l => l()); })
    .catch(() => { /* 标记是附加信息，读不到就不显示 */ })
    .finally(() => { loading = undefined; });
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function useVerifiedPortrait(storageKey?: string): Placement | undefined {
  useEffect(() => { if (storageKey) load(); }, [storageKey]);
  return useSyncExternalStore(subscribe, () => (storageKey ? verified.get(storageKey) : undefined), () => undefined);
}

export const PORTRAIT_VERIFIED_TEXT: Record<Placement, string> = {
  person: '已通过人脸核验并存入素材库，之后用这张图生成视频无需再次审核。',
  virtual: '已通过虚拟人像审核并存入素材库，之后用这张图生成视频无需再次审核。',
};

const FACE_VERIFIED_TEXT = '已通过人脸核验。';

export function PortraitVerifiedMark({ storageKey, faceVerified = false }: { storageKey?: string; faceVerified?: boolean }) {
  const placement = useVerifiedPortrait(storageKey);
  if (!placement && !faceVerified) return null;
  const text = placement ? PORTRAIT_VERIFIED_TEXT[placement] : FACE_VERIFIED_TEXT;
  return <Tooltip title={text} placement="top" getPopupContainer={studioOverlayContainer}>
    <span className="portrait-verified-mark" role="img" aria-label={text}><ShieldCheck size={14}/></span>
  </Tooltip>;
}
