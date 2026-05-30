"use client";

import * as React from "react";
import { Tags, Music2, Layers, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listGenres, listSongs } from "@/api/music";
import { listDigitalIps } from "@/api/digital-ips";
import type { MusicGenre, Song } from "@/types/music";
import type { Artist } from "@/types/artist";

const DOMAINS = [
  { id: "music", name: "音乐", icon: "🎵" },
  { id: "stage", name: "舞台表演", icon: "🎭" },
  { id: "film", name: "影视", icon: "🎬" },
  { id: "variety", name: "综艺", icon: "📺" },
  { id: "endorsement", name: "商业代言", icon: "💼" },
  { id: "education", name: "教育培训", icon: "📚" },
  { id: "game", name: "游戏娱乐", icon: "🎮" },
  { id: "folk", name: "曲艺表演", icon: "🎤" },
];

export default function GenresPage() {
  const [genres, setGenres] = React.useState<MusicGenre[]>([]);
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [artists, setArtists] = React.useState<Artist[]>([]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const [g, s, a] = await Promise.all([
        listGenres().catch(() => [] as MusicGenre[]),
        listSongs().catch(() => [] as Song[]),
        listDigitalIps(0, 500).catch(() => [] as Artist[]),
      ]);
      if (!active) return;
      setGenres(g);
      setSongs(s);
      setArtists(a);
    })();
    return () => { active = false; };
  }, []);

  const genreUsage = React.useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach((s) => map.set(s.genre, (map.get(s.genre) ?? 0) + 1));
    return map;
  }, [songs]);

  const domainUsage = React.useMemo(() => {
    const map = new Map<string, number>();
    artists.forEach((a) => a.domains.forEach((d) => map.set(d, (map.get(d) ?? 0) + 1)));
    return map;
  }, [artists]);

  return (
    <div className="admin-page">
      <PageHeader
        title="曲风 / 领域"
        description="维护基础分类数据：音乐曲风与艺人领域，影响前台筛选和匹配逻辑"
        breadcrumb={[{ label: "运营基础数据" }, { label: "曲风 / 领域" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 新建分类
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="曲风数量" value={genres.length} icon={Music2} />
        <StatCard label="领域数量" value={DOMAINS.length} icon={Layers} />
        <StatCard label="已使用曲风" value={genreUsage.size} icon={Tags} tone="success" />
        <StatCard label="覆盖艺人数" value={artists.length} icon={Tags} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>分类明细</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="genres">
            <TabsList>
              <TabsTrigger value="genres">音乐曲风 ({genres.length})</TabsTrigger>
              <TabsTrigger value="domains">艺人领域 ({DOMAINS.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="genres">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>图标</TableHead>
                    <TableHead>曲风</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>色标</TableHead>
                    <TableHead>使用歌曲</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {genres.map((g) => {
                    const used = genreUsage.get(g.name) ?? 0;
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="text-2xl">{g.icon}</TableCell>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{g.id}</TableCell>
                        <TableCell>
                          <Badge tone="info">{g.color}</Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">{used}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="outline">
                              <Pencil className="h-3.5 w-3.5" /> 编辑
                            </Button>
                            <Button size="sm" variant="ghost" disabled={used > 0}>
                              下线
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="domains">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>图标</TableHead>
                    <TableHead>领域</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>关联艺人</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DOMAINS.map((d) => {
                    const used = domainUsage.get(d.name) ?? 0;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-2xl">{d.icon}</TableCell>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{d.id}</TableCell>
                        <TableCell className="tabular-nums text-sm">{used}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="outline">
                              <Pencil className="h-3.5 w-3.5" /> 编辑
                            </Button>
                            <Button size="sm" variant="ghost" disabled={used > 0}>
                              下线
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
