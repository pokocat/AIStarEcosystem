// 资产 Tab：我的资产库；官方形象在 ?tab=official。
import { Suspense } from 'react';
import { AssetsLibrary, AssetsLoading } from "@/components/hub/assets-library";

export default function AssetsPage() {
  return <Suspense fallback={<AssetsLoading/>}><AssetsLibrary /></Suspense>;
}
