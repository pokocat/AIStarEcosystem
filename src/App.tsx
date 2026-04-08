import { Suspense, lazy, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ThemeProvider } from './components/ThemeProvider';
import { useStudioData } from './hooks/useStudioData';
import { HomePage } from './pages/HomePage';
import { PortalPage } from './pages/PortalPage';
import { ProducerIntroPage } from './pages/ProducerIntroPage';
import type { Lang, RootView } from './types/app';

const FanAppPage = lazy(() => import('./pages/FanAppPage').then((module) => ({ default: module.FanAppPage })));
const ProducerDashboardPage = lazy(() => import('./pages/ProducerDashboardPage').then((module) => ({ default: module.ProducerDashboardPage })));
const CoachDashboardPage = lazy(() => import('./pages/CoachDashboardPage').then((module) => ({ default: module.CoachDashboardPage })));

function PageFallback() {
  return <div className="min-h-screen bg-black text-gray-500 flex items-center justify-center">Loading...</div>;
}

function AppRuntime() {
  const [page, setPage] = useState<RootView>('home');
  const [lang, setLang] = useState<Lang>('zh');
  const data = useStudioData(lang);

  return (
    <div className="min-h-screen bg-black text-white">
      <AnimatePresence mode="wait">
        {page === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <HomePage lang={lang} copy={data.copy} onEnter={() => setPage('portal')} onToggleLang={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))} />
          </motion.div>
        )}

        {page === 'portal' && (
          <motion.div key="portal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PortalPage lang={lang} copy={data.copy.portal} onSelectRole={(role) => setPage(role)} onToggleLang={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))} />
          </motion.div>
        )}

        {page === 'producer_intro' && (
          <motion.div key="producer_intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ProducerIntroPage lang={lang} copy={data.copy.portal} onEnterApp={() => setPage('producer_app')} onToggleLang={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))} />
          </motion.div>
        )}

        {page === 'fan' && (
          <motion.div key="fan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Suspense fallback={<PageFallback />}>
              <FanAppPage lang={lang} copy={data.copy.fan} chartData={data.chartData} lyrics={data.lyrics} onBack={() => setPage('home')} onToggleLang={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))} />
            </Suspense>
          </motion.div>
        )}

        {page === 'producer_app' && (
          <motion.div key="producer_app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Suspense fallback={<PageFallback />}>
              <ProducerDashboardPage
                lang={lang}
                copy={data.copy.producer}
                mockSingers={data.mockSingers}
                earningData={data.earningData}
                transactions={data.transactions}
                onLogout={() => setPage('home')}
                onToggleLang={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))}
              />
            </Suspense>
          </motion.div>
        )}

        {page === 'coach' && (
          <motion.div key="coach" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Suspense fallback={<PageFallback />}>
              <CoachDashboardPage lang={lang} copy={data.copy.coach} onLogout={() => setPage('home')} onToggleLang={() => setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRuntime />
    </ThemeProvider>
  );
}
