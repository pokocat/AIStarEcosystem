// 资产 Tab：我的资产库（官方名录在 /discover）。
import { Suspense } from 'react';
import { AssetsLibrary } from "@/components/hub/assets-library";

export default function AssetsPage() {
  return <Suspense fallback={<p role="status">正在打开资产…</p>}><AssetsLibrary /></Suspense>;
}
