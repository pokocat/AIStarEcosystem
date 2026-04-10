"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Coins,
  Fingerprint,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Mic2,
  Rocket,
  Smile,
  Wallet,
  X,
  Zap
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { themeConfig, useTheme } from "@/components/ThemeProvider";
import OnboardingGuide from "@/components/OnboardingGuide";
import { useProducerWorkspace } from "@/features/producer/hooks/use-producer-workspace";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";

interface ProducerShellProps {
  children: ReactNode;
}

const routeMap = {
  overview: "/producer/overview",
  persona: "/producer/incubator",
  studio: "/producer/studio",
  distribution: "/producer/distribution",
  nft_mint: "/producer/mint",
  earnings: "/producer/earnings",
  community: "/producer/community"
} as const;

export function ProducerShell({ children }: ProducerShellProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const { lang, copy, toggleLang } = useDictionary();
  const workspace = useProducerWorkspace();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: routeMap.overview, label: copy.producer.sidebar.dashboard, icon: LayoutDashboard, locked: false },
    { href: routeMap.persona, label: copy.producer.sidebar.incubator, icon: Fingerprint, locked: false },
    { href: routeMap.studio, label: copy.producer.sidebar.studio, icon: Mic2, locked: false },
    { href: routeMap.distribution, label: copy.producer.sidebar.distribution, icon: Rocket, locked: false },
    { href: routeMap.nft_mint, label: copy.producer.sidebar.mint, icon: Coins, locked: false },
    { href: routeMap.earnings, label: copy.producer.sidebar.earnings, icon: Wallet, locked: false },
    { href: routeMap.community, label: copy.producer.sidebar.community, icon: Smile, locked: true }
  ];

  const currentTitle = navItems.find((item) => pathname.startsWith(item.href))?.label ?? copy.producer.sidebar.dashboard;

  const navigateFromOnboarding = (page: string) => {
    const target = routeMap[page as keyof typeof routeMap];
    if (target) {
      router.push(target);
      workspace.completeOnboarding();
    }
  };

  const sidebarItems = navItems.map((item) => {
    const Icon = item.icon;
    const active = pathname.startsWith(item.href);
    const classes = active ? themeStyles.itemActive : themeStyles.itemBase;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${classes}`}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{item.label}</span>
        {item.locked && <Lock className="h-3 w-3 text-gray-600" />}
      </Link>
    );
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#09090b] text-white md:flex-row">
      <aside className={`hidden w-64 shrink-0 border-r md:flex md:flex-col ${themeStyles.bg} ${themeStyles.border}`}>
        <div className={`flex h-16 items-center gap-2 border-b px-4 ${themeStyles.border}`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 ${themeStyles.glow}`}>
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">AI Studio Pro</span>
        </div>

        <div className={`border-b p-4 ${themeStyles.border}`}>
          <label className="mb-3 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {copy.producer.sidebar.switch}
          </label>
          <Dialog>
            <DialogTrigger asChild>
              <button className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10 rounded-lg border border-white/10">
                      <AvatarImage src={workspace.activeSinger?.avatarUrl} />
                      <AvatarFallback>{workspace.activeSinger?.name?.[0] ?? "A"}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#18181b] bg-green-500" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold leading-none transition-colors group-hover:text-cyan-400">
                      {workspace.activeSinger?.name ?? "Loading"}
                    </div>
                    <div className="mt-1.5 inline-block rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
                      {workspace.activeSinger?.style ?? "--"}
                    </div>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] rounded-2xl border-white/10 bg-[#18181b] text-white md:w-full">
              <DialogHeader>
                <DialogTitle>{copy.producer.sidebar.switch}</DialogTitle>
                <DialogDescription>Select active workspace singer</DialogDescription>
              </DialogHeader>
              <div className="mt-2 space-y-2">
                {workspace.singerWorkspace?.singers.map((singer) => (
                  <button
                    key={singer.id}
                    onClick={() => workspace.setActiveSingerId(singer.id)}
                    className="flex w-full items-center gap-4 rounded-xl border border-transparent p-3 text-left transition-all hover:border-cyan-500/30 hover:bg-white/5"
                  >
                    <Avatar className="h-12 w-12 rounded-lg">
                      <AvatarImage src={singer.avatarUrl} />
                      <AvatarFallback>{singer.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-base font-bold">{singer.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {singer.style}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          <ThemeSwitcher lang={lang} />
          <div className="h-2" />
          {sidebarItems}
        </div>

        <div className={`space-y-2 border-t bg-black/20 p-4 ${themeStyles.border}`}>
          <Button variant="ghost" onClick={toggleLang} className="w-full justify-start text-gray-500 hover:text-white">
            <Globe className="mr-2 h-4 w-4" />
            {lang === "zh" ? "Switch to English" : "切换中文"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/portal")}
            className="w-full justify-start text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {copy.producer.sidebar.logout}
          </Button>
        </div>
      </aside>

      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0c0c0e]/90 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 shadow-[0_0_10px_rgba(8,145,178,0.5)]">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">AI Studio</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen((current) => !current)} className="text-white">
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-white/10 bg-[#0c0c0e]/95 p-4 backdrop-blur-xl md:hidden">
          <div className="space-y-2">{sidebarItems}</div>
        </div>
      ) : null}

      <main className="flex-1 overflow-y-auto bg-[#09090b] pb-24 md:pb-0">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-white/10 bg-[#09090b]/80 px-8 backdrop-blur-md md:flex">
          <h2 className="flex items-center gap-3 text-lg font-medium text-white">
            <span className="text-gray-500">Workspace /</span>
            <span>{currentTitle}</span>
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400">
              <Zap className="h-3 w-3" />
              <span>Internal BFF Ready</span>
            </div>
            <Button size="sm" className="rounded-full bg-white font-bold text-black hover:bg-gray-200">
              Export
            </Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-7xl p-6 pb-24 md:p-10 md:pb-24">{children}</div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex h-[88px] items-center justify-around border-t border-white/10 bg-[#0c0c0e]/95 px-2 pt-2 backdrop-blur-xl md:hidden">
        {navItems.filter((item) => !item.locked).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-16 flex-col items-center justify-center gap-1.5 transition-all ${
                active ? "scale-110 text-cyan-400" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <OnboardingGuide
        isOpen={workspace.showOnboarding}
        onComplete={workspace.completeOnboarding}
        lang="en"
        onNavigate={navigateFromOnboarding}
      />
    </div>
  );
}
