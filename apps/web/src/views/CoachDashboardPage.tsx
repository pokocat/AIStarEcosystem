"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Award, ChevronRight, Disc, Globe as GlobeIcon, LayoutDashboard, LogOut, MessageSquare, Settings, TrendingUp, Users } from "lucide-react";
import type { Lang } from "../types/app";
import type { CoachTrainee, DashboardMetrics } from "@/types/contracts/analytics";

interface CoachDashboardPageProps {
  lang: Lang;
  copy: any;
  metrics: DashboardMetrics;
  trainees: CoachTrainee[];
  onLogout: () => void;
  onToggleLang: () => void;
}

export function CoachDashboardPage({ lang, copy, metrics, trainees, onLogout, onToggleLang }: CoachDashboardPageProps) {
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);
  const trainee = trainees.find((item) => item.id === selectedTrainee) || null;

  return (
    <div className="flex h-screen bg-[#0f0f12] text-white overflow-hidden">
      <aside className="w-20 lg:w-64 border-r border-white/10 bg-[#141418] flex flex-col transition-all">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-white/10">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)]"><Award className="w-5 h-5 text-white" /></div>
          <span className="font-bold text-lg text-purple-100 ml-3 hidden lg:block tracking-wider">COACH<span className="text-purple-500">OS</span></span>
        </div>
        <div className="p-4 space-y-2 flex-1">
          <Button variant="ghost" className="w-full justify-center lg:justify-start bg-purple-500/10 text-purple-400 border border-purple-500/20"><LayoutDashboard className="lg:mr-3 w-5 h-5" /><span className="hidden lg:block">{copy.sidebar.cmd}</span></Button>
          <Button variant="ghost" className="w-full justify-center lg:justify-start text-gray-400 hover:text-white hover:bg-white/5"><Users className="lg:mr-3 w-5 h-5" /><span className="hidden lg:block">{copy.sidebar.trainees}</span></Button>
          <Button variant="ghost" className="w-full justify-center lg:justify-start text-gray-400 hover:text-white hover:bg-white/5"><MessageSquare className="lg:mr-3 w-5 h-5" /><span className="hidden lg:block">{copy.sidebar.msg}</span> <Badge className="ml-auto bg-red-500 h-5 w-5 p-0 items-center justify-center hidden lg:flex">3</Badge></Button>
          <Button variant="ghost" className="w-full justify-center lg:justify-start text-gray-400 hover:text-white hover:bg-white/5"><Settings className="lg:mr-3 w-5 h-5" /><span className="hidden lg:block">{copy.sidebar.settings}</span></Button>
        </div>
        <div className="p-4 border-t border-white/10 space-y-2">
          <Button variant="ghost" onClick={onToggleLang} className="w-full justify-center lg:justify-start text-gray-400 hover:text-white"><GlobeIcon className="lg:mr-3 w-4 h-4" /><span className="hidden lg:block">{lang === "zh" ? "EN" : "中"}</span></Button>
          <Button variant="outline" onClick={onLogout} className="w-full justify-center lg:justify-start border-white/10 text-gray-400 hover:text-white hover:bg-white/5"><LogOut className="lg:mr-3 w-4 h-4" /><span className="hidden lg:block">{copy.sidebar.logout}</span></Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#0f0f12]/95 backdrop-blur z-20">
          <h1 className="text-xl font-bold flex items-center gap-2"><span className="text-gray-500">Region:</span> {copy.header.region} <span className="flex h-2 w-2 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span></h1>
          <div className="flex items-center gap-4"><div className="text-right hidden md:block"><div className="text-xs text-gray-400">{copy.header.value}</div><div className="text-lg font-bold font-mono text-green-400">¥ {metrics.revenueCny.toLocaleString()}</div></div><Avatar className="border border-white/20"><AvatarImage src="https://github.com/shadcn.png" /><AvatarFallback>CX</AvatarFallback></Avatar></div>
        </header>

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex justify-between items-end mb-6"><div><h2 className="text-2xl font-bold mb-1">{copy.monitor.title}</h2><p className="text-gray-400 text-sm">{copy.monitor.desc}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" className="border-white/10"><Settings className="w-4 h-4 mr-2" /> {copy.monitor.filter}</Button><Button size="sm" className="bg-purple-600 hover:bg-purple-500"><Users className="w-4 h-4 mr-2" /> {copy.monitor.new_task}</Button></div></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="bg-[#141418] border-white/5"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><Disc className="w-6 h-6" /></div><div><div className="text-2xl font-bold">{metrics.newSongs}</div><div className="text-xs text-gray-500">{copy.monitor.kpi_songs}</div></div></CardContent></Card>
              <Card className="bg-[#141418] border-white/5"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-green-500/10 rounded-lg text-green-400"><TrendingUp className="w-6 h-6" /></div><div><div className="text-2xl font-bold">{metrics.successRate}%</div><div className="text-xs text-gray-500">{copy.monitor.kpi_rate}</div></div></CardContent></Card>
              <Card className="bg-[#141418] border-white/5"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-red-500/10 rounded-lg text-red-400"><MessageSquare className="w-6 h-6" /></div><div><div className="text-2xl font-bold">{metrics.pendingReviews}</div><div className="text-xs text-gray-500">{copy.monitor.kpi_review}</div></div></CardContent></Card>
            </div>

            <div className="bg-[#141418] border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr><th className="p-4 font-medium">{copy.table.producer}</th><th className="p-4 font-medium">{copy.table.status}</th><th className="p-4 font-medium">{copy.table.progress}</th><th className="p-4 font-medium">{copy.table.rev}</th><th className="p-4 font-medium text-right">{copy.table.action}</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {trainees.map((item) => (
                    <tr key={item.id} onClick={() => setSelectedTrainee(item.id)} className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedTrainee === item.id ? "bg-purple-900/20" : ""}`}>
                      <td className="p-4 flex items-center gap-3"><Avatar className="w-8 h-8 rounded-md"><AvatarImage src={item.avatarUrl} /><AvatarFallback>{item.name[0]}</AvatarFallback></Avatar><div><div className="font-bold">{item.name}</div><div className="text-xs text-gray-500">{item.lastActive}</div></div></td>
                      <td className="p-4"><Badge variant="outline" className={`${item.status === "On Track" ? "border-green-500/30 text-green-400 bg-green-500/10" : ""} ${item.status === "Warning" ? "border-red-500/30 text-red-400 bg-red-500/10" : ""} ${item.status === "Star" ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10" : ""}`}>{item.status}</Badge></td>
                      <td className="p-4"><div className="flex items-center gap-3"><Progress value={item.progress} className="h-1.5 w-24 bg-gray-800" /><span className="text-xs text-gray-500">{item.progress}%</span></div></td>
                      <td className="p-4 font-mono">¥ {item.revenue}</td>
                      <td className="p-4 text-right"><Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10"><ChevronRight className="w-4 h-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence>
            {trainee && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 350, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="border-l border-white/10 bg-[#141418] flex flex-col">
                <div className="p-6 border-b border-white/10 flex justify-between items-start"><div className="flex flex-col items-center w-full"><div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-purple-500 to-pink-500 mb-3"><img src={trainee.avatarUrl} className="w-full h-full rounded-full object-cover border-4 border-[#141418]" alt={trainee.name} /></div><h3 className="text-xl font-bold">{trainee.name}</h3><p className="text-sm text-gray-400">Level 3 Producer</p><div className="flex gap-2 mt-4 w-full"><Button className="flex-1 bg-white text-black hover:bg-gray-200">{copy.detail.msg}</Button><Button variant="outline" className="flex-1 border-white/10">{copy.detail.profile}</Button></div></div></div>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{copy.detail.latest}</h4>
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5"><div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 bg-cyan-900/20 rounded flex items-center justify-center text-cyan-400"><Disc className="w-5 h-5" /></div><div><div className="font-bold text-sm">{trainee.latestSubmissionTitle}</div><div className="text-xs text-gray-500">{copy.detail.submitted} {trainee.lastActive}</div></div></div><div className="h-8 bg-gray-800 rounded flex items-center justify-center gap-1 opacity-50">{[...Array(15)].map((_, index) => <div key={index} className="w-1 bg-gray-400 rounded-full" style={{ height: `${8 + (index % 6) * 3}px` }} />)}</div><div className="flex gap-2 mt-3"><Button size="sm" className="flex-1 bg-green-600 hover:bg-green-500 h-8 text-xs">{copy.detail.approve}</Button><Button size="sm" variant="outline" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 text-xs">{copy.detail.reject}</Button></div></div>
                  </div>
                  <div><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{copy.detail.radar}</h4><div className="aspect-square bg-black/40 rounded-lg border border-white/5 flex items-center justify-center relative"><div className="w-32 h-32 border border-gray-700 rounded-full opacity-30 absolute" /><div className="w-20 h-20 border border-gray-700 rounded-full opacity-30 absolute" /><div className="w-10 h-10 border border-gray-700 rounded-full opacity-30 absolute" /><svg className="w-full h-full absolute p-8" viewBox="0 0 100 100"><path d="M50 10 L80 40 L70 80 L30 80 L20 40 Z" fill="rgba(147, 51, 234, 0.4)" stroke="#9333ea" strokeWidth="2" /></svg></div></div>
                </div>
                <div className="p-4 border-t border-white/10"><Button variant="ghost" className="w-full text-gray-500 hover:text-white" onClick={() => setSelectedTrainee(null)}>{copy.detail.close}</Button></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
