"use client";

import * as React from "react";
import { Clapperboard, Film, Megaphone, Mic } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";
import { DRAMA_STATUS, MOVIE_STATUS, AD_STATUS, VOICE_WORK_STATUS } from "@/constants/status";
import { formatCountCN, formatCurrencyCN } from "@/lib/utils";

export default function FilmReviewPage() {
  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="影视 / MV 审核"
        description="短剧、电影、广告与配音项目的进度与上线审核"
        breadcrumb={[{ label: "内容审核" }, { label: "影视 / MV" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="短剧" value={DRAMAS.length} icon={Clapperboard} />
        <StatCard label="电影" value={MOVIES.length} icon={Film} />
        <StatCard label="广告" value={ADS.length} icon={Megaphone} />
        <StatCard label="配音" value={VOICE_WORKS.length} icon={Mic} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>内容审核队列</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="dramas">
            <TabsList>
              <TabsTrigger value="dramas">短剧</TabsTrigger>
              <TabsTrigger value="movies">电影</TabsTrigger>
              <TabsTrigger value="ads">广告</TabsTrigger>
              <TabsTrigger value="voice">配音</TabsTrigger>
            </TabsList>

            <TabsContent value="dramas">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>剧目</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>集数</TableHead>
                    <TableHead>出演</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">播放量</TableHead>
                    <TableHead className="text-right">收益</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DRAMAS.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.genre}</TableCell>
                      <TableCell className="text-sm">{d.episodes} 集</TableCell>
                      <TableCell className="text-sm">{d.role}</TableCell>
                      <TableCell>
                        <StatusBadge meta={DRAMA_STATUS[d.status]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCountCN(d.views)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCurrencyCN(d.revenue)}</TableCell>
                      <TableCell className="text-right">
                        {d.status === "post-production" ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="success">批准上线</Button>
                            <Button size="sm" variant="destructive">驳回</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost">查看</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="movies">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>片名</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">票房</TableHead>
                    <TableHead className="text-right">分成</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOVIES.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.genre}</TableCell>
                      <TableCell className="text-sm capitalize">{m.role}</TableCell>
                      <TableCell>
                        <StatusBadge meta={MOVIE_STATUS[m.status]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {m.boxOffice ? formatCurrencyCN(m.boxOffice) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrencyCN(m.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.status === "post-production" ? (
                          <Button size="sm" variant="success">批准上映</Button>
                        ) : (
                          <Button size="sm" variant="ghost">查看</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="ads">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>品牌</TableHead>
                    <TableHead>产品</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>时长</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">报酬</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ADS.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.brand}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.product}</TableCell>
                      <TableCell className="text-sm uppercase">{a.type}</TableCell>
                      <TableCell className="tabular-nums text-sm">{a.duration}s</TableCell>
                      <TableCell>
                        <StatusBadge meta={AD_STATUS[a.status]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCurrencyCN(a.payment)}</TableCell>
                      <TableCell className="text-right">
                        {a.status === "negotiating" ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="success">通过合约</Button>
                            <Button size="sm" variant="destructive">驳回</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost">查看</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="voice">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>时长（分）</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">报酬</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {VOICE_WORKS.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.project}</TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">{v.type}</TableCell>
                      <TableCell className="tabular-nums text-sm">{v.duration}</TableCell>
                      <TableCell>
                        <StatusBadge meta={VOICE_WORK_STATUS[v.status]} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCurrencyCN(v.payment)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost">查看</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
