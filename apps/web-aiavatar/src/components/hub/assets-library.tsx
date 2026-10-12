"use client";
import React, { useState } from "react";
import { ArrowUpRight, Mic, Users } from "lucide-react";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { PersonalAssetLibrary } from "@/ip/personal-asset-library";
import { AvatarLibrary, VoiceLibrary } from "@/ip/supplementary-asset-library";
import { studioOverlayContainer } from "@/ip/studio-overlay";
import Link from "next/link";
import { AssetApi, AvatarApi, LicenseApi, VoiceApi } from "@/proto/api";
import type { Avatar, License, StarGrant, VoiceAsset } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { settled, useHubData } from "@/components/hub/data";
import { HubScreen } from "@/components/hub/ui";

export function AssetsLibrary() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";

  const [avatarRevision, setAvatarRevision] = useState(0);
  const [voiceRevision, setVoiceRevision] = useState(0);
  const avatars = useHubData<Avatar[]>(() => AvatarApi.list("mine"), [], [avatarRevision], ready);
  const voices = useHubData<VoiceAsset[]>(() => VoiceApi.mine(), [], [voiceRevision], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [avatarRevision], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [avatarRevision], ready);

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const activeGrants = settled(grants) ? grants.data.filter((g) => g.status === "authorized") : [];

  return (
    <HubScreen tabBar className="ip-brand-surface ip-hub-surface assets-library">
      <header className="assets-library-heading">
        <div><h1>资产库</h1><p>你的角色、场景与创作素材，都在这里。</p></div>
        <Link href="/create" className="ip-brand-button">开始创作<ArrowUpRight size={16} /></Link>
      </header>
      <ConfigProvider locale={zhCN} getPopupContainer={studioOverlayContainer} theme={{ token: { colorPrimary: '#192229', controlItemBgActive: '#eeefef', controlItemBgHover: '#f6f6f5', borderRadius: 8, fontFamily: 'var(--ip-ui)' } }}>
      <App className="assets-library-content" data-studio-overlay-root>
      <PersonalAssetLibrary supplementaryTabs={[
        {
          key: 'avatars', label: '人物形象', icon: <Users size={17}/>,
          count: avatars.loading || grants.loading || avatars.error || grants.error ? undefined : avatars.data.length + activeGrants.length,
          children: <AvatarLibrary avatars={avatars} grants={grants} licenses={licenses} refresh={() => setAvatarRevision(n => n + 1)}/>,
        },
        {
          key: 'voices', label: '专属声音', icon: <Mic size={17}/>,
          count: voices.loading || voices.error ? undefined : voices.data.length,
          children: <VoiceLibrary voices={voices} refresh={() => setVoiceRevision(n => n + 1)}/>,
        },
      ]}/>
      </App>
      </ConfigProvider>
    </HubScreen>
  );
}
