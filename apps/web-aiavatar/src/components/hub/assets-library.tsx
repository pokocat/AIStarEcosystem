"use client";
// ============================================================
// 资产（2026-09-01 五 Tab 定案）：只有「我的」，官方名录搬去「发现」。
//   人物与形象（自建 + 明星授权给我的）/ 声音 / 素材库
// ============================================================
import React from "react";
import { ArrowUpRight, Mic, Users } from "lucide-react";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { PersonalAssetLibrary } from "@/ip/personal-asset-library";
import { studioOverlayContainer } from "@/ip/studio-overlay";
import Link from "next/link";
import { AssetApi, AvatarApi, LicenseApi, VoiceApi } from "@/proto/api";
import type { Avatar, License, StarGrant, VoiceAsset } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { settled, studioHref, useHubData } from "@/components/hub/data";
import { AvatarCard, StarGrantCard } from "@/components/hub/asset-cards";
import { Card, EmptyState, HubScreen, LinkAction, LoadingBlock, RegNo, SectionHeader } from "@/components/hub/ui";

export function AssetsLibrary() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";

  const avatars = useHubData<Avatar[]>(() => AvatarApi.list("mine"), [], [], ready);
  const voices = useHubData<VoiceAsset[]>(() => VoiceApi.mine(), [], [], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [], ready);
  const grants = useHubData<StarGrant[]>(() => AssetApi.starGrants(), [], [], ready);

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const licenseKnown = settled(licenses);
  const licenseByChar = new Map(licenses.data.filter((l) => l.char).map((l) => [l.char as string, l]));
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
        { key: 'avatars', label: '人物形象', icon: <Users size={17}/>, count: avatars.loading || grants.loading || avatars.error || grants.error ? undefined : avatars.data.length + activeGrants.length, children:
      <div className="assets-library-secondary">
        <SectionHeader
          title="人物与形象"
          hint="都可以直接拿去创作视频"
          count={avatars.loading || grants.loading ? undefined : avatars.data.length + activeGrants.length}
        />
        {avatars.loading || grants.loading ? (
          <LoadingBlock />
        ) : avatars.error ? (
          <Card>
            <EmptyState text={avatars.error} />
          </Card>
        ) : avatars.data.length + activeGrants.length === 0 ? (
          <Card>
            <EmptyState text="还没有数字人，从一段视频就能开始" actionHref="/create" actionLabel="创建数字人" />
          </Card>
        ) : (
          <div className="hub-list">
            {avatars.data.map((c) => (
              <AvatarCard key={c.id} c={c} license={licenseByChar.get(c.id) || null} licenseKnown={licenseKnown} />
            ))}
            {activeGrants.map((g) => (
              <StarGrantCard key={g.id} g={g} />
            ))}
          </div>
        )}
        {grants.error && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--err)", textAlign: "center" }}>
            明星授权加载失败：{grants.error}
          </div>
        )}
      </div>

        },
        { key: 'voices', label: '专属声音', icon: <Mic size={17}/>, count: voices.loading || voices.error ? undefined : voices.data.length, children:
      <div className="assets-library-secondary">

        <SectionHeader
          title="声音"
          count={voices.loading ? undefined : voices.data.length}
          action={<LinkAction href={studioHref("#/voice")}>声音工作室 ›</LinkAction>}
        />
        {voices.loading ? (
          <LoadingBlock />
        ) : voices.error ? (
          <Card>
            <EmptyState text={voices.error} />
          </Card>
        ) : voices.data.length === 0 ? (
          <Card>
            <EmptyState text="还没有专属声音" actionHref={studioHref("#/voice")} actionLabel="去录一段" />
          </Card>
        ) : (
          <div className="hub-grid-2">
            {voices.data.map((v) => (
              <Link key={v.id} href={studioHref("#/voice")} style={{ textDecoration: "none", color: "inherit" }}>
                <Card radius={13} pad={12} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.name}
                  </span>
                  <RegNo size={9.5}>{`${v.id} · ${v.kind === "clone" ? "克隆声" : v.kind === "preset" ? "预设音色" : "设计声"} · ${v.dur}`}</RegNo>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

        },
      ]} />
      </App>
      </ConfigProvider>
    </HubScreen>
  );
}
