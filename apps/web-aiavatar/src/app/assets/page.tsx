// 资产 Tab：我的资产库（官方名录在 /discover）。
import { Suspense } from 'react';
import { AssetsLibrary } from "@/components/hub/assets-library";
import { StudioPage } from "@/ip/studio-page";

export default function AssetsPage() {
  return <Suspense fallback={<StudioPage title="资产" description="人物、声音与创作素材，让每一次灵感有所承接。" nextDescription="人物、声音和素材，做什么都能直接拿来用" className="assets-library ip-management-page"><p role="status">正在打开资产…</p></StudioPage>}><AssetsLibrary /></Suspense>;
}
