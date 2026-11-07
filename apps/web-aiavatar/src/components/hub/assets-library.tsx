"use client";
import { AssetsHub } from '@/ip/assets-hub';
import { ASSETS_DESCRIPTION } from '@/ip/assets-hub-shared';
import { StudioPage } from '@/ip/studio-page';
import { PlatformGateScreen, useRequireAuth } from './auth';

export function AssetsLoading() {
  return <StudioPage title="资产" description={ASSETS_DESCRIPTION} className="assets-hub-page"><p role="status">正在加载资产…</p></StudioPage>;
}

export function AssetsLibrary() {
  const auth = useRequireAuth();
  if (auth === 'no-platform') return <PlatformGateScreen/>;
  if (auth !== 'ok') return <AssetsLoading/>;
  return <AssetsHub/>;
}
