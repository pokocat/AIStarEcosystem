import { useEffect, useRef } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Avatar, AvatarImage } from '../components/ui/avatar';
import { Cpu, Fingerprint, Globe as GlobeIcon, Music2, Sparkles, Users, Zap } from 'lucide-react';
import { motion, useMotionValue } from 'motion/react';
import type { Lang } from '../types/app';

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.fill();

        for (let next = index + 1; next < particles.length; next += 1) {
          const other = particles[next];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(147, 51, 234, ${0.15 * (1 - dist / 150)})`;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

interface HomePageProps {
  lang: Lang;
  copy: any;
  onEnter: () => void;
  onToggleLang: () => void;
}

export function HomePage({ lang, copy, onEnter, onToggleLang }: HomePageProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  return (
    <div
      className="relative min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden"
      onMouseMove={(event) => {
        mouseX.set((event.clientX - window.innerWidth / 2) / 50);
        mouseY.set((event.clientY - window.innerHeight / 2) / 50);
      }}
    >
      <nav className="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 cursor-pointer" onClick={onEnter}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              AI Star <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">Eco</span>
            </span>
          </motion.div>

          <div className="hidden md:flex items-center gap-8">
            {[copy.nav.features, copy.nav.showcase, copy.nav.ecosystem, copy.nav.about].map((item: string, index: number) => (
              <motion.button key={item} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * index }} onClick={onEnter} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                {item}
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onToggleLang} className="text-gray-400 hover:text-white">
              <GlobeIcon className="w-4 h-4 mr-1" /> {lang === 'zh' ? 'EN' : '中'}
            </Button>
            <Button onClick={onEnter} className="bg-white text-black hover:bg-gray-200 font-bold rounded-full px-6 shadow-lg shadow-white/10">
              {copy.nav.enter}
            </Button>
          </div>
        </div>
      </nav>

      <div className="relative min-h-screen flex flex-col justify-center pt-20 overflow-hidden">
        <ParticleBackground />
        <div className="absolute top-[20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-purple-800/20 to-cyan-800/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />

        <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-12 gap-12 items-center flex-1">
          <motion.div style={{ x: mouseX, y: mouseY }} className="lg:col-span-7 space-y-8">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-md mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </span>
                <span className="text-xs font-medium text-cyan-300 tracking-wide uppercase">AI Singer Ecosystem Live v2.5.1</span>
              </div>

              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold leading-[0.95] text-white tracking-tighter mb-8">
                {lang === 'zh' ? '代码即歌喉。' : 'Code Is Voice.'}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-gradient-x bg-[length:200%_auto]">
                  {lang === 'zh' ? '唤醒数字生命。' : 'Awaken Digital Life.'}
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-400 max-w-xl leading-relaxed border-l-2 border-cyan-500/30 pl-6 mb-8">
                {lang === 'zh'
                  ? '面向制作人、教练与粉丝的统一生态系统，覆盖 AI 歌手孵化、音乐生成、分发和链上资产化。'
                  : 'A unified ecosystem for producers, coaches, and fans across AI incubation, music generation, distribution, and on-chain monetization.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={onEnter} size="lg" className="h-14 px-8 text-base font-bold rounded-full bg-white text-black hover:bg-cyan-50 shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:scale-105">
                  {copy.hero.cta_primary}
                </Button>
                <Button onClick={onEnter} size="lg" variant="outline" className="h-14 px-8 text-base font-medium rounded-full border-white/20 bg-transparent text-white hover:bg-white/5 backdrop-blur-md hover:border-white/40 transition-all">
                  {copy.hero.cta_secondary}
                </Button>
              </div>

              <div className="mt-12 flex items-center gap-6 text-gray-500 text-sm font-mono flex-wrap">
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-cyan-500" /> {lang === 'zh' ? '50k+ 制作人' : '50k+ Producers'}</div>
                <div className="w-1 h-1 bg-gray-700 rounded-full" />
                <div className="flex items-center gap-2"><Music2 className="w-4 h-4 text-purple-500" /> {copy.hero.stats_songs}</div>
                <div className="w-1 h-1 bg-gray-700 rounded-full hidden sm:block" />
                <div className="flex items-center gap-2 hidden sm:flex"><Fingerprint className="w-4 h-4 text-pink-500" /> {lang === 'zh' ? '200k+ 基因库' : '200k+ Genes'}</div>
              </div>
            </motion.div>
          </motion.div>

          <div className="lg:col-span-5 relative h-[500px] w-full hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#1a1a2e] to-[#0f0f12] rounded-[2.5rem] border border-white/10 backdrop-blur-sm p-8 flex flex-col justify-between overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <h3 className="text-white font-bold text-lg flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-400" /> Ecosystem Monitor</h3>
                  <p className="text-gray-500 text-xs font-mono">System Status: Optimal</p>
                </div>
                <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><div className="w-2 h-2 rounded-full bg-yellow-500" /><div className="w-2 h-2 rounded-full bg-green-500" /></div>
              </div>

              <div className="relative z-10 self-center w-full max-w-[320px] space-y-4">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2"><Badge variant="outline" className="text-[10px] h-5 border-green-500/30 text-green-400 bg-green-500/10">ACTIVE</Badge></div>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10 border border-purple-500/30"><AvatarImage src="https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=200" /></Avatar>
                    <div>
                      <div className="text-sm font-bold text-white">Neon V</div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1"><Cpu className="w-3 h-3" /> Gene Mixing: 98%</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-800/50 h-1.5 rounded-full overflow-hidden mb-2">
                    <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500" initial={{ width: '0%' }} animate={{ width: '98%' }} transition={{ duration: 2, delay: 0.5 }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono"><span>Model: C-Punk v4</span><span>ETA: 00:02</span></div>
                </motion.div>

                <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 7, delay: 1, repeat: Infinity, ease: 'easeInOut' }} className="bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-4 shadow-2xl ml-8">
                  <div className="flex justify-between items-center mb-3"><span className="text-xs font-bold text-white">Real-time Revenue</span><span className="text-xs text-green-400 font-mono">+12.4%</span></div>
                  <div className="h-16 w-full bg-gradient-to-b from-cyan-900/10 to-transparent rounded border border-white/5 relative overflow-hidden flex items-end px-1 pb-0 gap-1">
                    {[40, 60, 30, 80, 50, 90, 70, 45, 65, 85, 55, 75].map((height, index) => (
                      <motion.div key={index} className="flex-1 bg-cyan-500/40 hover:bg-cyan-400/80 transition-colors rounded-t-sm" initial={{ height: '0%' }} animate={{ height: `${height}%` }} transition={{ duration: 0.8, delay: index * 0.05 }} />
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full bg-[#0c0c0e] border-y border-white/5 py-3 relative z-20 mt-12 overflow-hidden">
          <div className="flex items-center justify-center gap-12 animate-marquee whitespace-nowrap text-xs sm:text-sm font-mono text-gray-500">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> LIVE: New Gene "Cyber-Elf" Synthesized by @User992</span>
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full" /> MARKET: Badge #8821 Sold for ¥1,200</span>
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" /> SYSTEM: Voice Engine v3.0 Deployment Complete</span>
          </div>
        </div>
      </div>

      <section className="py-24 bg-[#050505] relative border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 mb-4">{copy.workflow.tag}</Badge>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{copy.workflow.title}</h2>
              <p className="text-gray-400 text-lg leading-relaxed">{copy.workflow.desc}</p>
            </div>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent -translate-y-1/2 z-0" />
            <div className="grid md:grid-cols-3 gap-8 relative z-10">
              {copy.workflow.steps.map((step: any, index: number) => (
                <div key={step.title} className="bg-[#0c0c0e] border border-white/10 p-8 rounded-2xl relative">
                  <div className="w-16 h-16 bg-black rounded-2xl border border-white/10 flex items-center justify-center mb-6 text-2xl font-bold text-gray-700 shadow-lg">0{index + 1}</div>
                  <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-black relative">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 h-auto md:h-[600px]">
            <div className="md:col-span-2 md:row-span-2 bg-[#121212] rounded-3xl p-8 border border-white/10 relative overflow-hidden">
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4"><Zap className="w-6 h-6 text-cyan-400" /></div>
                  <h3 className="text-3xl font-bold text-white mb-2">{copy.features.saas_title}</h3>
                  <p className="text-gray-400 max-w-md">{copy.features.saas_desc}</p>
                </div>
                <div className="mt-8 rounded-xl bg-black/50 border border-white/5 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-3"><div className="w-3 h-3 rounded-full bg-red-500" /><div className="w-3 h-3 rounded-full bg-yellow-500" /><div className="w-3 h-3 rounded-full bg-green-500" /></div>
                  <div className="space-y-2"><div className="h-2 w-1/3 bg-gray-700 rounded-full" /><div className="h-2 w-2/3 bg-gray-800 rounded-full" /><div className="h-2 w-1/2 bg-gray-800 rounded-full" /></div>
                </div>
              </div>
            </div>
            <div className="bg-[#121212] rounded-3xl p-6 border border-white/10 flex flex-col justify-center"><Users className="w-8 h-8 text-pink-400 mb-4" /><h4 className="text-xl font-bold text-white">{copy.features.dao_title}</h4><p className="text-sm text-gray-400 mt-2">{copy.features.dao_desc}</p></div>
            <div className="bg-[#121212] rounded-3xl p-6 border border-white/10 flex flex-col justify-center"><Sparkles className="w-8 h-8 text-purple-400 mb-4" /><h4 className="text-xl font-bold text-white">{copy.features.assets_title}</h4><p className="text-sm text-gray-400 mt-2">{copy.features.assets_desc}</p></div>
          </div>
        </div>
      </section>

      <section className="py-20 relative overflow-hidden bg-gradient-to-b from-black to-[#0a0a0a]">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-8">{lang === 'zh' ? '准备定义未来了吗？' : 'Ready to define the future?'}</h2>
          <Button onClick={onEnter} size="lg" className="h-14 px-8 rounded-full bg-white text-black hover:bg-gray-200">{copy.nav.enter}</Button>
          <div className="mt-12 text-gray-600 text-sm">© 2024 AI Star Eco. All rights reserved.</div>
        </div>
      </section>
    </div>
  );
}
