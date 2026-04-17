"use client";

import * as React from "react";
import Image from "next/image";
import { PersonStanding, Smile, Hand, Plus, Lock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { POSE_DIFFICULTY } from "@/constants/status";
import { POSE_DATABASE, EXPRESSION_DATABASE, GESTURE_DATABASE } from "@/mocks/pose";
import type { PoseCategory } from "@/types/pose";

const POSE_CAT_LABEL: Record<PoseCategory, string> = {
  standing: "站姿",
  sitting: "坐姿",
  dancing: "舞蹈",
  singing: "演唱",
  action: "动作",
};

const POSE_CATS: PoseCategory[] = ["standing", "sitting", "dancing", "singing", "action"];

export default function PosePage() {
  const [poseCat, setPoseCat] = React.useState<PoseCategory | "all">("all");

  const poseList = POSE_DATABASE.filter((p) => poseCat === "all" || p.category === poseCat);
  const locked = POSE_DATABASE.filter((p) => p.isLocked).length;
  const newPoses = POSE_DATABASE.filter((p) => p.isNew).length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="动作 / 表情 / 手势库"
        description="艺人表演素材库：姿态、表情、手势三大维度"
        breadcrumb={[{ label: "运营基础数据" }, { label: "动作与表情" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 新增素材
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="姿态总数" value={POSE_DATABASE.length} icon={PersonStanding} />
        <StatCard label="表情总数" value={EXPRESSION_DATABASE.length} icon={Smile} />
        <StatCard label="手势总数" value={GESTURE_DATABASE.length} icon={Hand} />
        <StatCard label="锁定素材" value={locked} hint={`新品 ${newPoses}`} icon={Lock} />
      </section>

      <Tabs defaultValue="poses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="poses">姿态 ({POSE_DATABASE.length})</TabsTrigger>
          <TabsTrigger value="expressions">表情 ({EXPRESSION_DATABASE.length})</TabsTrigger>
          <TabsTrigger value="gestures">手势 ({GESTURE_DATABASE.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="poses">
          <Card>
            <CardHeader>
              <CardTitle>姿态库</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={poseCat} onValueChange={(v) => setPoseCat(v as PoseCategory | "all")}>
                <TabsList>
                  <TabsTrigger value="all">全部</TabsTrigger>
                  {POSE_CATS.map((c) => (
                    <TabsTrigger key={c} value={c}>
                      {POSE_CAT_LABEL[c]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={poseCat}>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {poseList.map((p) => (
                      <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
                        <div className="aspect-square relative bg-surface-muted">
                          <Image src={p.thumbnail} alt={p.name} fill sizes="200px" className="object-cover" />
                          <div className="absolute top-1.5 left-1.5 flex gap-1">
                            {p.isNew && (
                              <Badge tone="success">
                                <Sparkles className="h-3 w-3" /> 新
                              </Badge>
                            )}
                            {p.isLocked && <Badge tone="neutral">🔒</Badge>}
                          </div>
                          <div className="absolute top-1.5 right-1.5">
                            <StatusBadge meta={POSE_DIFFICULTY[p.difficulty]} />
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{POSE_CAT_LABEL[p.category]}</div>
                          <div className="flex items-center justify-end mt-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs">编辑</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expressions">
          <Card>
            <CardHeader>
              <CardTitle>表情库</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {EXPRESSION_DATABASE.map((e) => (
                  <div key={e.id} className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 card-shadow">
                    <div className="text-4xl">{e.emoji}</div>
                    <div className="font-medium text-sm">{e.name}</div>
                    <div className="w-full">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>强度</span>
                        <span className="tabular-nums">{e.intensity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${e.intensity}%` }} />
                      </div>
                    </div>
                    <Badge tone="info">{e.category}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gestures">
          <Card>
            <CardHeader>
              <CardTitle>手势库</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {GESTURE_DATABASE.map((g) => (
                  <div key={g.id} className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 card-shadow">
                    <div className="text-4xl">{g.icon}</div>
                    <div className="font-medium text-sm">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.category}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
