import React, { useState, useEffect, useRef } from 'react';
import { Globe as GlobeIcon, LogOut, ChevronDown, Menu, X, CheckCircle2, Sparkles, Bell, Ticket } from 'lucide-react';
import { Button } from "../ui/button";
import { motion, AnimatePresence } from "motion/react";
import { sidebarStyle } from "../ThemeProvider";
import { ColorModeToggle } from "../ColorModeToggle";
import type { Lang } from "../../translations";
import { IncubationWizard } from "./IncubationWizard";
import { SettingsPage } from "./SettingsPage";
import { NotificationPanel } from "./NotificationPanel";
import { CommandPalette } from "./CommandPalette";
import { MOCK_ARTISTS, ARTIST_TYPE_LABELS, type Artist, type ArtistType } from './ArtistTypes';
import { QuickCreateMenu } from "./FloatingActions";
import { TrainingCenter } from "../training/TrainingCenter";
import { ActivationCodePanel } from "./ActivationCodePanel";
import { AccountManagementCenter } from "./AccountManagementCenter";
import { DataAnalytics } from "./DataAnalytics";
import { TrafficBoostCenter } from "./TrafficBoostCenter";
import { CelebrityWorkbench } from "../celebrity/CelebrityWorkbench";
import { BrandPortal } from "../brand/BrandPortal";
import { RoleSwitcherFAB } from "./RoleSwitcherFAB";
import type { PortalRole } from "./RoleSwitcherFAB";
import { LiveControlRoom } from "../matrix/LiveControlRoom";
import { NotificationCenter } from "../NotificationCenter";
import { ArtistHub } from "./ArtistHub";
import { AssetCenter } from "./AssetCenter";
import { ProductionWorkshop, type WorkshopIntent, type WorkshopTab } from "./ProductionWorkshop";
import { PublishCenter } from "./PublishCenter";
import { MonetizationCenter } from "./MonetizationCenter";
import { FanOperations } from "./FanOperations";
import { ComplianceTools } from "./ComplianceTools";
import { OverviewDashboard } from "./OverviewDashboard";
import { setCurrentProjectScope } from "./director/studioStorage";
import { NAV_GROUPS, FOOTER_PAGES, findPage, resolveRoute, recommendedPages } from "./consoleNav";
import { getSolutionLabel, type SolutionId } from "../../data/ipPlatform";

const SidebarItem = ({ icon: Icon, label, id, active, onClick, themeStyles, recommended, zh }: any) => (
  <button
    onClick={() => onClick(id)}
    title={recommended ? (zh ? '当前方案推荐' : 'Recommended for this solution') : undefined}
    className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      active === id ? themeStyles.itemActive : themeStyles.itemBase
    }`}
  >
    <Icon size={18} />
    <span className="font-medium">{label}</span>
    {recommended && (label
      ? <span className="ml-auto rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">{zh ? '推荐' : 'Pick'}</span>
      : <span aria-hidden className="absolute left-7 top-2 h-1.5 w-1.5 rounded-full bg-violet-500" />)}
  </button>
);

// Artist-type accent used for the small avatar badge.
const TYPE_DOT: Record<ArtistType, string> = {
  singer: '#06b6d4', actor: '#a855f7', entertainer: '#ec4899', dancer: '#f59e0b', host: '#22c55e', all_rounder: '#ef4444', idol: '#6366f1',
};

/* ======== Main Dashboard ======== */
const ProducerDashboard = ({ onLogout, lang, setLang, initialRole = 'operator', initialSolution = 'ecosystem', hideRoleSwitcher = false, onRoleChange }: { onLogout: () => void; lang: Lang; setLang: (l: Lang) => void; initialRole?: PortalRole; initialSolution?: SolutionId; hideRoleSwitcher?: boolean; onRoleChange?: (role: PortalRole) => void }) => {
  const zh = lang === 'zh';
  const themeStyles = sidebarStyle;
  const [activeArtist, setActiveArtist] = useState<Artist>(MOCK_ARTISTS[0]);
  const [activePage, setActivePageRaw] = useState('overview');
  // Deep-link target inside a hub page (e.g. 发布中心 › 内容日历); a new nonce remounts the page on it.
  const [pageTab, setPageTab] = useState<string | undefined>();
  const [navNonce, setNavNonce] = useState(0);
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('director');
  // Each navigation starts at the top of the new page (desktop scrolls this pane, mobile the window).
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [navNonce]);
  const [workshopIntent, setWorkshopIntent] = useState<WorkshopIntent | null>(null);
  // Accepts a page id, a legacy id (see ROUTE_ALIASES) or `page/tab`. The type workshops (音乐工坊 etc.)
  // live in the AI Director: 'studio' opens its new-project dialog, 'works' its works library.
  const setActivePage = (target: string) => {
    setNavNonce(n => n + 1);
    if (target === 'studio' || target === 'works') {
      setWorkshopTab('director');
      setWorkshopIntent({ kind: target === 'works' ? 'works' : 'new', id: Date.now() });
      setActivePageRaw('production_workshop');
      return;
    }
    const { page, tab } = resolveRoute(target);
    if (page === 'production_workshop') {
      // Without a tab, reopen AI 创作 in its current mode (batch tools fall back to AI 导演).
      setWorkshopTab((prev: WorkshopTab) => (tab as WorkshopTab | undefined) ?? (prev === 'image' || prev === 'video' ? prev : 'director'));
      setWorkshopIntent(null);
    }
    setPageTab(tab);
    setActivePageRaw(page);
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showArtistSwitcher, setShowArtistSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [portalRole, setPortalRole] = useState<PortalRole>(initialRole);
  // Let the host (global port switcher) mirror role changes made inside the console.
  useEffect(() => {
    if (portalRole !== initialRole) onRoleChange?.(portalRole);
  }, [portalRole]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showIncubationWizard, setShowIncubationWizard] = useState(false);
  const [showActivationCode, setShowActivationCode] = useState(false);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNavigate = (page: string) => {
    if (page === 'incubation') {
      setShowIncubationWizard(true);
    } else {
      setActivePage(page);
    }
  };

  const openProject = (artistId: string, scope: string) => {
    const artist = MOCK_ARTISTS.find(a => a.id === artistId);
    if (artist) setActiveArtist(artist);
    // The AI 导演 opens the project last marked current for this solution + IP.
    setCurrentProjectScope(`${initialSolution}:${artistId}`, scope);
    setActivePage('production_workshop/director');
  };

  const renderPage = () => {
    const tab = pageTab;
    switch (activePage) {
      case 'artist_hub': return <ArtistHub lang={lang} initialTab={tab} onNavigateWorkshop={() => setActivePage('studio')} onIncubate={() => setShowIncubationWizard(true)} onGoToTraining={() => setActivePage('training')} />;
      case 'production_workshop': return <ProductionWorkshop lang={lang} activeArtist={activeArtist} solutionId={initialSolution} tab={workshopTab} onTabChange={setWorkshopTab} intent={workshopIntent} onOpenPublish={() => setActivePage('publish_center/pool')} />;
      case 'asset_center': return <AssetCenter lang={lang} activeArtist={activeArtist} initialTab={tab} />;
      case 'publish_center': return <PublishCenter lang={lang} activeArtist={activeArtist} initialTab={tab} />;
      case 'account_mgmt': return <AccountManagementCenter lang={lang} />;
      case 'traffic_boost': return <TrafficBoostCenter lang={lang} />;
      case 'live_control': return <LiveControlRoom lang={lang} />;
      case 'fan_operations': return <FanOperations lang={lang} activeArtist={activeArtist} initialTab={tab} />;
      case 'monetization_center': return <MonetizationCenter lang={lang} activeArtist={activeArtist} initialTab={tab} />;
      case 'analytics': return <DataAnalytics lang={lang} />;
      case 'compliance_tools': return <ComplianceTools lang={lang} activeArtist={activeArtist} initialTab={tab} />;
      case 'training': return <TrainingCenter lang={lang} />;
      case 'settings': return <SettingsPage lang={lang} setLang={setLang} initialTab={tab} />;
      case 'notifications': return <NotificationCenter lang={lang} />;
      default: return <OverviewDashboard lang={lang} solutionId={initialSolution} activeArtist={activeArtist} onNavigate={handleNavigate} onOpenProject={openProject} />;
    }
  };

  const recommended = recommendedPages(initialSolution);
  const currentPage = findPage(activePage);
  const currentPageLabel = currentPage ? (zh ? currentPage.zh : currentPage.en) : '';

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Sparkles className="w-6 h-6 text-cyan-400 shrink-0" />
        {(sidebarOpen || isMobile) && (
          <>
            <span className="text-base font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>AI Star Eco</span>
            <span className="eyebrow-mono rounded-full border border-cyan-200 px-1.5 py-0.5 text-cyan-700" style={{ fontSize: 9, letterSpacing: '0.12em' }}>Studio</span>
          </>
        )}
        {isMobile && <button onClick={() => setMobileSidebar(false)} className="ml-auto"><X className="w-5 h-5 text-gray-400" /></button>}
      </div>

      {/* Active artist switcher */}
      {(sidebarOpen || isMobile) && (
        <div className="px-3 py-3 border-b border-gray-200 relative">
          <button onClick={() => setShowArtistSwitcher(!showArtistSwitcher)}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
            <div className="relative">
              <img src={activeArtist.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-cyan-500/20" />
              <div aria-hidden className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: TYPE_DOT[activeArtist.type] }} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-semibold truncate">{activeArtist.name}</div>
              <div className="text-[10px] text-gray-500 flex items-center gap-1">
                {zh ? ARTIST_TYPE_LABELS[activeArtist.type].zh : ARTIST_TYPE_LABELS[activeArtist.type].en}
                <span className="text-cyan-400">Lv.{activeArtist.level}</span>
              </div>
            </div>
            <ChevronDown className={`w-3 h-3 text-gray-500 transition ${showArtistSwitcher ? 'rotate-180' : ''}`} />
          </button>
          {/* Dropdown */}
          <AnimatePresence>
            {showArtistSwitcher && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {MOCK_ARTISTS.map(artist => {
                  return (
                    <button key={artist.id}
                      onClick={() => { setActiveArtist(artist); setShowArtistSwitcher(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition text-left ${artist.id === activeArtist.id ? 'bg-amber-50' : ''}`}>
                      <img src={artist.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{artist.name}</div>
                        <div className="text-[10px] text-gray-500">{ARTIST_TYPE_LABELS[artist.type][lang]} · Lv.{artist.level}</div>
                      </div>
                      {artist.id === activeArtist.id && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Nav items grouped */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title.en} className="mb-3">
            {(sidebarOpen || isMobile) && (
              // Numbered mono eyebrow, as the homepage's "DOMAIN / 01" labels.
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="eyebrow-mono text-slate-400">{String(gi + 1).padStart(2, '0')}</span>
                <span className="text-[11px] font-medium text-slate-500">{zh ? group.title.zh : group.title.en}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {group.pages.map(item => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  label={(sidebarOpen || isMobile) ? (zh ? item.zh : item.en) : ''}
                  id={item.id}
                  active={activePage}
                  onClick={(id: string) => { setActivePage(id); if (isMobile) setMobileSidebar(false); }}
                  themeStyles={themeStyles}
                  recommended={recommended.has(item.id)}
                  zh={zh}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-gray-200 space-y-1">
        {(sidebarOpen || isMobile) && <ColorModeToggle lang={zh ? 'zh' : 'en'} variant="row" />}
        {FOOTER_PAGES.map(item => (
          <SidebarItem key={item.id} icon={item.icon} label={(sidebarOpen || isMobile) ? (zh ? item.zh : item.en) : ''} id={item.id} active={activePage}
            onClick={(id: string) => { setActivePage(id); if (isMobile) setMobileSidebar(false); }} themeStyles={themeStyles} />
        ))}
        <button onClick={onLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${themeStyles.itemBase}`}>
          <LogOut size={18} />
          {(sidebarOpen || isMobile) && <span className="font-medium">{zh ? '返回首页' : 'Back Home'}</span>}
        </button>
      </div>
    </>
  );

  // Role portal overrides — FAB always appended
  if (portalRole === 'celebrity') return (
    <>
      <CelebrityWorkbench lang={lang} onBack={() => setPortalRole('operator')} />
      {!hideRoleSwitcher && <RoleSwitcherFAB currentRole={portalRole} lang={lang} onSwitch={setPortalRole} />}
    </>
  );
  if (portalRole === 'brand') return (
    <>
      <BrandPortal lang={lang} onBack={() => setPortalRole('operator')} />
      {!hideRoleSwitcher && <RoleSwitcherFAB currentRole={portalRole} lang={lang} onSwitch={setPortalRole} />}
    </>
  );
  return (
    <>
    <div className="console-ambient h-screen w-full flex bg-gray-50 text-gray-900 overflow-hidden" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
      {/* Sidebar — Desktop */}
      <motion.aside
        initial={{ width: 260 }}
        animate={{ width: sidebarOpen ? 260 : 72 }}
        className={`hidden md:flex flex-col ${themeStyles.bg} border-r ${themeStyles.border} shrink-0 overflow-hidden`}
      >
        {renderSidebarContent()}
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileSidebar(false)} className="md:hidden fixed inset-0 bg-black/60 z-40" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 25 }}
              className={`md:hidden fixed left-0 top-0 bottom-0 w-[260px] ${themeStyles.bg} border-r ${themeStyles.border} z-50 flex flex-col`}>
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileSidebar(true)}><Menu className="w-5 h-5 text-gray-400" /></button>
            <button className="hidden md:block" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5 text-gray-400 hover:text-gray-700 transition" />
            </button>
            <div className="text-sm text-gray-500 font-light">{currentPageLabel}</div>
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-1 text-[10px] text-cyan-700">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-cyan-400 opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-cyan-500" /></span>
              {getSolutionLabel(initialSolution)[lang]}
            </div>
            <button onClick={() => setShowCommandPalette(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-gray-300 hover:text-gray-700 transition ml-2">
              <span>{zh ? '搜索...' : 'Search...'}</span>
              <kbd className="text-[10px] bg-white/5 rounded px-1 py-0.5 border border-white/10">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <QuickCreateMenu lang={lang} onNavigate={handleNavigate} />
            <ColorModeToggle lang={zh ? 'zh' : 'en'} className="text-gray-500" />
            <button
              onClick={() => setShowActivationCode(true)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700 group"
              title={zh ? '激活码兑换' : 'Redeem Code'}
            >
              <Ticket className="w-4 h-4" />
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-500"
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </button>
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700">
                <Bell className="w-4 h-4" />
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              </button>
              <NotificationPanel lang={lang} open={showNotifications} onClose={() => setShowNotifications(false)} onViewAll={() => setActivePage('notifications')} />
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-2 py-1">
              <img src={activeArtist.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
              <span className="text-xs text-gray-400 hidden sm:block">{activeArtist.name}</span>
              <span className="hidden sm:inline text-[10px] text-gray-500">{ARTIST_TYPE_LABELS[activeArtist.type][lang]}</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-2 pb-24 md:p-4">
          <AnimatePresence mode="wait">
            <motion.div key={`${activePage}:${navNonce}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .25 }}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Command Palette */}
        <CommandPalette
          lang={lang}
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={handleNavigate}
          onSwitchArtist={setActiveArtist}
        />

        {/* Floating Quick Actions */}
      </div>
    </div>

      {/* Incubation Wizard - Full Screen Overlay */}
      {showIncubationWizard && (
        <div className="fixed inset-0 z-[100] bg-gray-50">
          <IncubationWizard
            lang={lang}
            onClose={() => {
              setShowIncubationWizard(false);
            }}
            onCreated={() => {
              setShowIncubationWizard(false);
              setActivePage('artist_hub');
            }}
            initialStep={0}
            solutionId={initialSolution}
          />
        </div>
      )}

      {/* Activation Code Panel - Modal Only */}
      <ActivationCodePanel
        lang={lang}
        open={showActivationCode}
        onOpenChange={setShowActivationCode}
        hideBanner={true}
      />

      {/* Always-visible role switcher FAB */}
      {!hideRoleSwitcher && <RoleSwitcherFAB currentRole={portalRole} lang={lang} onSwitch={setPortalRole} />}
    </>
  );
};

export default ProducerDashboard;
