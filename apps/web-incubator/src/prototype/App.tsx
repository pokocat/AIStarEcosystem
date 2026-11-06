// 搬自 Figma Make 原型的入口。相对原型的改动（其余文件尽量不动）：
// 去掉未挂载的旧页面；语言固定中文（AGENTS.md §4.6）；当前端写进地址栏（?end=），
// 刷新和浏览器后退可用；挂上运营后台；角落标「演示数据」。
import React, { useState, useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeProvider } from './components/ThemeProvider';
import type { Lang } from './translations';
import { SolutionSwitcher } from './components/SolutionSwitcher';
import { PortSwitcher, type PortId } from './components/PortSwitcher';
import { lazyWithReload } from './lazyWithReload';
import { getPresetForSolution, writeStoredPreset } from './data/ipSolutionPreset';
import { SOLUTION_CONFIGS, isSolutionId, type SolutionId } from './data/ipPlatform';

// Each page is loaded on demand so visitors only download the page they open.
const HomePage = lazyWithReload(() => import('./components/HomePage').then(m => ({ default: m.HomePage })));
const IPEcosystemLandingPage = lazyWithReload(() => import('./components/IPEcosystemLandingPage'));
const SolutionLandingPage = lazyWithReload(() => import('./components/SolutionLandingPage'));
const MCNConsole = lazyWithReload(() => import('./components/mcn/MCNConsole'));
const AdminConsole = lazyWithReload(() => import('./components/admin/AdminConsole'));
const FanAppFull = lazyWithReload(() => import('./components/FanAppFull').then(m => ({ default: m.FanAppFull })));
const LoginPage = lazyWithReload(() => import('./components/LoginPage').then(m => ({ default: m.LoginPage })));
const EntrepreneurMiniApp = lazyWithReload(() => import('./components/miniapp/EntrepreneurMiniApp').then(m => ({ default: m.EntrepreneurMiniApp })));
const ClipMiniApp = lazyWithReload(() => import('./components/miniapp/ClipMiniApp').then(m => ({ default: m.ClipMiniApp })));

type AppPage = 'home' | 'producer_login' | 'producer_app' | 'celebrity_ip' | 'brand_portal' | 'admin' | 'fan' | 'miniapp_entrepreneur' | 'miniapp_clip';

const APP_PAGES: AppPage[] = ['home', 'producer_login', 'producer_app', 'celebrity_ip', 'brand_portal', 'admin', 'fan', 'miniapp_entrepreneur', 'miniapp_clip'];

const PAGE_TO_PORT: Partial<Record<AppPage, PortId>> = {
  producer_login: 'creator', producer_app: 'creator',
  celebrity_ip: 'celebrity', brand_portal: 'brand', admin: 'admin', fan: 'fan',
  miniapp_entrepreneur: 'miniapp_entrepreneur', miniapp_clip: 'miniapp_clip',
};

const LANG: Lang = 'zh';
const keepChinese = () => {};

const readPageFromUrl = (): AppPage => {
  const end = new URLSearchParams(window.location.search).get('end');
  return APP_PAGES.includes(end as AppPage) ? (end as AppPage) : 'home';
};

const PageFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
  </div>
);

export default function App() {
  const [page, setPage] = useState<AppPage>(readPageFromUrl);
  const [creatorSignedIn, setCreatorSignedIn] = useState(() => readPageFromUrl() === 'producer_app');
  const [previousPage, setPreviousPage] = useState<AppPage>('home');
  const [landingSolution, setLandingSolution] = useState<SolutionId>(() => {
    const match = window.location.hash.match(/^#\/solutions\/([^/]+)/);
    return match && isSolutionId(match[1]) ? match[1] : 'ecosystem';
  });

  const navigate = (next: AppPage) => {
    setPage(next);
    const url = new URL(window.location.href);
    if (next === 'home') {
      url.searchParams.delete('end');
    } else {
      url.searchParams.set('end', next);
      url.hash = '';
    }
    window.history.pushState(null, '', url);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const syncFromUrl = () => {
      const match = window.location.hash.match(/^#\/solutions\/([^/]+)/);
      if (match && isSolutionId(match[1])) setLandingSolution(match[1]);
      setPage(readPageFromUrl());
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  // In-page anchors (href="#cases") would otherwise overwrite the #/solutions/{id} route; scroll instead.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href');
      if (!href || href.startsWith('#/')) return;
      event.preventDefault();
      if (href.length > 1) document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const selectLandingSolution = (solution: SolutionId) => {
    setLandingSolution(solution);
    setPage('home');
    window.history.pushState(null, '', `${window.location.pathname}#/solutions/${solution}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToPort = (port: PortId) => {
    const target: AppPage =
      port === 'creator' ? (creatorSignedIn ? 'producer_app' : 'producer_login')
      : port === 'celebrity' ? 'celebrity_ip'
      : port === 'brand' ? 'brand_portal'
      : port;
    setPreviousPage(page);
    navigate(target);
  };

  const enterFromSolution = () => {
    writeStoredPreset(getPresetForSolution(landingSolution));
    goToPort('creator');
  };

  const goHome = () => navigate('home');
  const goBack = () => navigate(previousPage === page ? 'home' : previousPage);
  const handleConsoleRole = (role: 'operator' | 'celebrity' | 'brand') =>
    goToPort(role === 'operator' ? 'creator' : role);
  const currentPort = PAGE_TO_PORT[page];
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  return (
    <ThemeProvider>
      <div className="bg-white min-h-screen text-gray-900">
        <Suspense fallback={<PageFallback />}>
          <AnimatePresence mode="wait">
            {page === 'home' && (
              <motion.div key={`home-${landingSolution}`} {...fade}>
                {landingSolution === 'ecosystem' ? (
                  <IPEcosystemLandingPage onEnter={enterFromSolution} onSelectSolution={selectLandingSolution} lang={LANG} setLang={keepChinese} />
                ) : landingSolution === 'ai-artist' ? (
                  <HomePage onEnter={enterFromSolution} onHome={() => selectLandingSolution('ecosystem')} lang={LANG} setLang={keepChinese} />
                ) : (
                  <SolutionLandingPage config={SOLUTION_CONFIGS[landingSolution]} onEnter={enterFromSolution} onSelectSolution={selectLandingSolution} lang={LANG} setLang={keepChinese} />
                )}
                <SolutionSwitcher value={landingSolution} lang={LANG} onChange={selectLandingSolution} />
              </motion.div>
            )}
            {page === 'fan' && <motion.div key="fan" initial={{opacity:0, x: 20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}}><FanAppFull onBack={goHome} lang={LANG} setLang={keepChinese} /></motion.div>}
            {page === 'producer_login' && <motion.div key="p-login" {...fade}><LoginPage onBack={goHome} onLoginSuccess={() => { setCreatorSignedIn(true); navigate('producer_app'); }} lang={LANG} /></motion.div>}
            {page === 'producer_app' && <motion.div key="p-app" {...fade}><MCNConsole onLogout={goHome} lang={LANG} setLang={keepChinese} initialSolution={landingSolution} hideRoleSwitcher onRoleChange={handleConsoleRole} /></motion.div>}
            {page === 'celebrity_ip' && <motion.div key="celebrity-ip" {...fade}><MCNConsole onLogout={goHome} lang={LANG} setLang={keepChinese} initialRole="celebrity" initialSolution={landingSolution} hideRoleSwitcher onRoleChange={handleConsoleRole} /></motion.div>}
            {page === 'brand_portal' && <motion.div key="brand-portal" {...fade}><MCNConsole onLogout={goHome} lang={LANG} setLang={keepChinese} initialRole="brand" initialSolution={landingSolution} hideRoleSwitcher onRoleChange={handleConsoleRole} /></motion.div>}
            {page === 'admin' && <motion.div key="admin" {...fade}><AdminConsole onLogout={goHome} lang={LANG} setLang={keepChinese} /></motion.div>}
            {page === 'miniapp_entrepreneur' && <motion.div key="miniapp-ent" {...fade}><EntrepreneurMiniApp lang={LANG} onBack={goBack} /></motion.div>}
            {page === 'miniapp_clip' && <motion.div key="miniapp-clip" {...fade}><ClipMiniApp lang={LANG} onBack={goBack} /></motion.div>}
          </AnimatePresence>
        </Suspense>
        {currentPort && (
          <PortSwitcher current={currentPort} lang={LANG} solution={landingSolution} onSwitch={goToPort} onHome={goHome} raised={page === 'fan'} compact={page === 'producer_app' || page === 'celebrity_ip' || page === 'brand_portal' || page === 'admin'} />
        )}
        <div
          className="demo-data-badge"
          title="页面内容均为示例数据，操作不会产生真实结果"
        >
          演示数据
        </div>
      </div>
    </ThemeProvider>
  );
}
