import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, PlayCircle, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { appService } from '../../../../api/serviceFactory';
import { STUDIO_MODES } from '../../../../data/mockData';
import { useGlobalAudio } from '../../../../hooks/useGlobalAudio';
import type { Track } from '../../../../types/entities';

export function StudioSection() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { playTrack, currentTrack, audioState } = useGlobalAudio();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [mode, setMode] = useState(STUDIO_MODES[0].id);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    appService
      .getProducerData('demo-producer')
      .then((res) => setTracks(res.tracks))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + Date.now() * 0.02) % width;
        const y = (i * 59 + Date.now() * 0.01) % height;
        ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const modeTrack = useMemo(() => tracks.find((t) => t.mode === mode), [tracks, mode]);

  const handleGenerate = () => {
    if (!modeTrack?.audioUrl) return;
    playTrack(
      { id: modeTrack.id, url: modeTrack.audioUrl, title: modeTrack.title },
      tracks
        .filter((t) => t.audioUrl)
        .map((t) => ({ id: t.id, title: t.title, url: t.audioUrl as string })),
    );
  };

  return (
    <section className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-6 text-white">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="relative z-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">AI Studio</h3>
            <p className="text-sm text-white/70">11 模式完整重构 · 服务层数据驱动</p>
          </div>
          <Button variant="outline" className="border-cyan-300/40 text-cyan-200">
            <Sparkles className="mr-2 size-4" /> 保持 Figma 风格层
          </Button>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="flex w-full flex-wrap gap-2 bg-transparent">
            {STUDIO_MODES.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="border border-white/10 bg-black/40 data-[state=active]:border-cyan-300/50">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <Card className="bg-black/40 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">{STUDIO_MODES.find((m) => m.id === mode)?.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt / 风格描述" className="bg-black/40 border-white/10" />
              <Textarea placeholder="歌词 / 结构 / 场景补充" className="bg-black/40 border-white/10" />
              <div className="flex items-center gap-3">
                <Button onClick={handleGenerate} disabled={loading || !modeTrack?.audioUrl}>
                  {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PlayCircle className="mr-2 size-4" />}
                  生成并试听（useGlobalAudio）
                </Button>
                <span className="text-sm text-white/70">
                  当前播放：{audioState.isPlaying ? currentTrack?.title ?? '未知曲目' : '未播放'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
