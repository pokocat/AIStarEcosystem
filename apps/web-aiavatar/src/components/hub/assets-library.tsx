"use client";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { PersonalAssetLibrary } from '@/ip/personal-asset-library';
import { AvatarLibrary, VoiceLibrary } from '@/ip/supplementary-asset-library';
import { IpManagement } from '@/ip/ip-management';
import { StudioPage, StudioPageFilters } from '@/ip/studio-page';
import { studioOverlayContainer } from '@/ip/studio-overlay';
import { AssetApi, AvatarApi, LicenseApi, VoiceApi } from '@/proto/api';
import type { Avatar, License, StarGrant, VoiceAsset } from '@/proto/data';
import { PlatformGateScreen, useRequireAuth } from './auth';
import { useHubData } from './data';

const tabs = [{value:'ips',label:'我的 IP'}, {value:'objects',label:'创作素材'}, {value:'materials',label:'生成与上传'}, {value:'voices',label:'声音'}, {value:'authorized',label:'授权形象'}];
export function AssetsLibrary() {
  const router = useRouter(), search = useSearchParams();
  const auth = useRequireAuth();
  const raw = search.get('tab');
  const tab = tabs.some(t => t.value === raw) ? raw! : 'ips';
  const [revision, setRevision] = useState(0);
  const avatars = useHubData<Avatar[]>(() => AvatarApi.list('mine'), [], [revision], auth === 'ok' && tab === 'authorized');
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [revision], auth === 'ok' && tab === 'authorized');
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [revision], auth === 'ok' && tab === 'authorized');
  const voices = useHubData<VoiceAsset[]>(() => VoiceApi.mine(), [], [revision], auth === 'ok' && tab === 'voices');
  const change = (next: string) => {
    const params = new URLSearchParams(search.toString());
    params.set('tab', next); params.delete('focus');
    router.push(`/assets?${params}`);
  };
  if (auth === 'no-platform') return <PlatformGateScreen/>;
  return <StudioPage title="资产" description="人物、声音与创作素材，让每一次灵感有所承接。" className="assets-library ip-management-page" actions={<Link href="/create" className="ip-brand-button">开始创作<ArrowUpRight size={16}/></Link>}>
    {auth !== 'ok' ? <p role="status">正在打开资产…</p> : <ConfigProvider locale={zhCN} getPopupContainer={studioOverlayContainer} theme={{token:{colorPrimary:'#192229',borderRadius:8,fontFamily:'var(--ip-ui)'}}}>
      <App className="assets-library-content" data-studio-overlay-root>
        <StudioPageFilters label="资产分类" items={tabs} value={tab} onChange={change}/>
        {tab === 'ips' ? <IpManagement embedded/> : tab === 'objects' || tab === 'materials' ? <PersonalAssetLibrary hideTabs initialTab={tab}/> : tab === 'voices' ? <VoiceLibrary voices={voices} refresh={() => setRevision(n => n+1)}/> : <AvatarLibrary avatars={avatars} grants={grants} licenses={licenses} refresh={() => setRevision(n => n+1)}/>}
      </App>
    </ConfigProvider>}
  </StudioPage>;
}
