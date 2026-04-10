"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingPanel } from "@/features/shared/components/page-feedback";

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trackId = searchParams.get("trackId") ?? "track-1";
  const title = searchParams.get("title") ?? "Untitled Track";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <div className="text-xs text-cyan-400 uppercase tracking-widest mb-2">NLE Editor</div>
          <h2 className="text-3xl font-black tracking-tight text-white">{title}</h2>
          <p className="text-sm text-gray-400 mt-2">多轨道音频与镜头节奏编辑工作区。</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/producer/studio")}
          className="border-white/10 hover:bg-white/5"
        >
          返回录音棚
        </Button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-base">素材与轨道</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {["Vocal", "Synth", "Drums", "FX"].map((track, index) => (
              <div key={track} className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-white">{track}</div>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                    {index + 1}
                  </Badge>
                </div>
                <div className="h-14 rounded-lg bg-black border border-white/5 flex items-center gap-1 px-2">
                  {Array.from({ length: 24 }, (_, barIndex) => (
                    <div
                      key={barIndex}
                      className="flex-1 bg-cyan-500/30 rounded-full"
                      style={{ height: `${20 + ((barIndex + index * 7) % 10) * 6}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8 bg-[#0c0c0e]/80 backdrop-blur-xl border-white/10 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">时间轴</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-black/50 p-6 h-[420px] relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
              <div className="relative z-10 space-y-5">
                {["Lead Vocal", "Harmony", "Beat", "Visual FX"].map((lane, laneIndex) => (
                  <div key={lane} className="space-y-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{lane}</div>
                    <div className="h-14 rounded-xl bg-[#09090b] border border-white/5 p-2 flex items-center gap-2">
                      {[28, 42, 34].map((width, clipIndex) => (
                        <div
                          key={`${lane}-${clipIndex}`}
                          className={`h-full rounded-lg border px-2 flex items-center text-xs font-bold ${
                            clipIndex % 2 === 0
                              ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
                              : "bg-purple-500/20 border-purple-500/30 text-purple-300"
                          }`}
                          style={{ width: `${width - laneIndex * 2}%` }}
                        >
                          Clip {clipIndex + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">
                应用修改
              </Button>
              <Button variant="outline" className="border-white/10 hover:bg-white/5">
                导出成片
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProducerEditorRoute() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading editor..." />}>
      <EditorContent />
    </Suspense>
  );
}
