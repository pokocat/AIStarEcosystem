"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Coins, Eye, Plus, Rocket, ShoppingBag, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProducerWorkspace } from "@/features/producer/hooks/use-producer-workspace";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";
import { ErrorPanel, LoadingPanel } from "@/features/shared/components/page-feedback";
import type { MarketplaceListing } from "@/types/contracts/marketplace";
import type { SingerDetail } from "@/types/contracts/singers";

const ArtistSigningDialog = dynamic(() => import("@/components/ArtistSigningDialog"), { ssr: false });
const ArtistDetailDialog = dynamic(() => import("@/components/ArtistDetailDialog"), { ssr: false });
const ArtistListingDialog = dynamic(() => import("@/components/ArtistListingDialog"), { ssr: false });

interface LegacyArtist {
  id: number;
  name: string;
  style: string;
  avatar: string;
  price: string;
  owner: string;
  songs: number;
  followers: string;
}

function toLegacyMarketArtist(listing: MarketplaceListing): LegacyArtist {
  return {
    id: Number.parseInt(listing.artistId.replace(/\D/g, ""), 10) || 0,
    name: listing.name,
    style: listing.style,
    avatar: listing.avatarUrl,
    price: listing.priceLabel,
    owner: listing.owner,
    songs: listing.songs,
    followers: listing.followersLabel
  };
}

function toLegacyActiveSinger(singer: SingerDetail): LegacyArtist {
  return {
    id: Number.parseInt(singer.id.replace(/\D/g, ""), 10) || 0,
    name: singer.name,
    style: singer.style,
    avatar: singer.avatarUrl,
    price: `¥ ${(6800 + singer.popularity * 35).toLocaleString()}`,
    owner: "AI Star Eco",
    songs: singer.songsCount,
    followers: `${(singer.fansCount / 1000).toFixed(1)}k`
  };
}

export default function ProducerOverviewRoute() {
  const router = useRouter();
  const { copy } = useDictionary();
  const workspace = useProducerWorkspace();
  const [signingArtist, setSigningArtist] = useState<LegacyArtist | null>(null);
  const [viewingArtist, setViewingArtist] = useState<LegacyArtist | null>(null);
  const [listingOpen, setListingOpen] = useState(false);

  const activeSingerCard = useMemo(
    () => (workspace.activeSinger ? toLegacyActiveSinger(workspace.activeSinger) : null),
    [workspace.activeSinger]
  );

  if (workspace.errors.length) {
    return <ErrorPanel title="Failed to load producer overview" detail={workspace.errors[0]} />;
  }

  if (workspace.isBootstrapping || !workspace.dashboard || !workspace.activeSinger) {
    return <LoadingPanel label="Loading producer overview..." />;
  }

  const { producerMetrics, earningsSeries, transactions, marketListings } = workspace.dashboard;
  const metrics = [
    {
      label: copy.producer.overview.metrics[0],
      value: producerMetrics.artistCount.toString(),
      accent: "text-purple-400",
      bg: "from-purple-900/30 to-purple-900/10 border-purple-500/20"
    },
    {
      label: copy.producer.overview.metrics[1],
      value: `${(producerMetrics.totalPlays / 1000000).toFixed(1)}M`,
      accent: "text-cyan-400",
      bg: "from-cyan-900/30 to-cyan-900/10 border-cyan-500/20"
    },
    {
      label: copy.producer.overview.metrics[2],
      value: producerMetrics.marketSignings.toString(),
      accent: "text-emerald-400",
      bg: "from-emerald-900/30 to-emerald-900/10 border-emerald-500/20"
    },
    {
      label: copy.producer.overview.metrics[3],
      value: `¥${Math.round(producerMetrics.revenueCny / 1000)}k`,
      accent: "text-pink-400",
      bg: "from-pink-900/30 to-pink-900/10 border-pink-500/20"
    }
  ];

  const priorityListings = marketListings.slice(0, 3).map(toLegacyMarketArtist);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-500">
            <div className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            AI Star Agency
          </div>
          <h1 className="mb-1 text-4xl font-black tracking-tight text-white">{copy.producer.overview.title}</h1>
          <p className="text-sm text-gray-400">{copy.producer.overview.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => router.push("/producer/incubator")}
            className="h-12 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 font-black tracking-widest text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:from-purple-500 hover:to-pink-500"
          >
            <Plus className="mr-2 h-5 w-5" />
            {copy.producer.overview.create}
          </Button>
          <Button
            onClick={() => setListingOpen(true)}
            variant="outline"
            className="h-12 rounded-xl border-white/10 px-6 hover:bg-white/5"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Open Market Listing
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
        {metrics.map((metric) => (
          <Card key={metric.label} className={`bg-gradient-to-br ${metric.bg} border backdrop-blur-xl`}>
            <CardContent className="p-6">
              <div className={`mb-2 text-3xl font-black ${metric.accent}`}>{metric.value}</div>
              <div className="text-sm text-gray-400">{metric.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl lg:col-span-7">
          <CardHeader>
            <CardTitle>Revenue & Activity</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsSeries}>
                <defs>
                  <linearGradient id="overview-song" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="overview-badge" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ background: "#0c0c0e", border: "1px solid rgba(255,255,255,0.1)" }} />
                <Area type="monotone" dataKey="song" stroke="#06b6d4" fill="url(#overview-song)" />
                <Area type="monotone" dataKey="badge" stroke="#a855f7" fill="url(#overview-badge)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Market Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {priorityListings.map((artist) => (
                <div key={artist.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-4">
                  <Avatar className="h-14 w-14 rounded-xl">
                    <AvatarImage src={artist.avatar} />
                    <AvatarFallback>{artist.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white">{artist.name}</div>
                    <div className="text-xs text-gray-400">{artist.style} · {artist.followers}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => setViewingArtist(artist)}>
                      详情
                    </Button>
                    <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500" onClick={() => setSigningArtist(artist)}>
                      签约
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-2xl border border-white/10">
                  <AvatarImage src={workspace.activeSinger.avatarUrl} />
                  <AvatarFallback>{workspace.activeSinger.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-black text-white">{workspace.activeSinger.name}</h3>
                  <p className="text-xs text-cyan-100/70">{workspace.activeSinger.style}</p>
                </div>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-cyan-100/70">
                将当前艺人打包为可签约资产，快速验证市场需求并承接合作邀约。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={() => router.push("/producer/studio")} className="bg-black/20 text-cyan-100 hover:bg-black/40">
                  <Sparkles className="mr-2 h-4 w-4" />
                  打开录音棚
                </Button>
                <Button onClick={() => router.push("/producer/mint")} className="bg-black/20 text-cyan-100 hover:bg-black/40">
                  <Coins className="mr-2 h-4 w-4" />
                  铸造 NFT
                </Button>
                <Button onClick={() => router.push("/producer/distribution")} className="bg-black/20 text-cyan-100 hover:bg-black/40">
                  <Rocket className="mr-2 h-4 w-4" />
                  去发行
                </Button>
                <Button onClick={() => setViewingArtist(activeSingerCard)} className="bg-black/20 text-cyan-100 hover:bg-black/40">
                  <Eye className="mr-2 h-4 w-4" />
                  查看艺人详情
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-white/10 bg-[#0c0c0e]/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-gray-500">
                <tr>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-left">Description</th>
                  <th className="p-4 text-left">Amount</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.slice(0, 5).map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-white/5">
                    <td className="p-4 text-gray-500">{transaction.date}</td>
                    <td className="p-4 font-bold text-gray-300">{transaction.description}</td>
                    <td className={`p-4 font-mono font-black ${transaction.amountLabel.startsWith("+") ? "text-emerald-400" : "text-white"}`}>
                      {transaction.amountLabel}
                    </td>
                    <td className="p-4 text-right">
                      <Badge
                        variant="outline"
                        className={
                          transaction.status === "Completed"
                            ? "border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-400"
                            : "border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 font-bold text-yellow-400"
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ArtistSigningDialog
        artist={signingArtist}
        isOpen={!!signingArtist}
        onClose={() => setSigningArtist(null)}
        onSuccess={async () => {
          if (!signingArtist) return;
          const listing = marketListings.find((item) => item.name === signingArtist.name);
          if (listing) {
            await workspace.signArtist({ artistId: listing.artistId, offerPriceLabel: listing.priceLabel });
          }
          setSigningArtist(null);
        }}
        lang="en"
      />
      <ArtistDetailDialog
        artist={viewingArtist}
        isOpen={!!viewingArtist}
        onClose={() => setViewingArtist(null)}
        lang="en"
        onCreateMusic={() => {
          if (viewingArtist) {
            const match = workspace.singerWorkspace?.singers.find((item) => item.name === viewingArtist.name);
            if (match) {
              workspace.setActiveSingerId(match.id);
            }
          }
          setViewingArtist(null);
          router.push("/producer/studio");
        }}
      />
      <ArtistListingDialog
        artist={listingOpen ? activeSingerCard : null}
        isOpen={listingOpen}
        onClose={() => setListingOpen(false)}
        onSuccess={() => setListingOpen(false)}
        lang="en"
      />
    </div>
  );
}
