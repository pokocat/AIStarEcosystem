// 资产 Tab：我的资产库（官方名录在 /discover）。
import { Suspense } from 'react';
import { AssetsLibrary } from "@/components/hub/assets-library";
import { StudioPage } from "@/ip/studio-page";

export default function AssetsPage() {
  return <Suspense fallback={<StudioPage title="资产" description="人物、声音和创作素材，创作时可直接使用。" nextDescription="上传和创作中产生的素材都在这里，创作时可直接使用。" className="assets-library ip-management-page"><p role="status">正在加载资产…</p></StudioPage>}><AssetsLibrary /></Suspense>;
}
