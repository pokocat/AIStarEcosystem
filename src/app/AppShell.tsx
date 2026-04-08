import { AnimatePresence, motion } from 'motion/react';
import { HomeView } from '../features/home/HomeView';
import { FanView } from '../features/fan/FanView';
import { CoachView } from '../features/coach/CoachView';
import { ProducerView } from '../features/producer/ProducerView';
import { useAppShell } from '../state/appShellStore';
import { GlobalDialogs } from './GlobalDialogs';

export function AppShell() {
  const { viewMode } = useAppShell();

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.22 }}
        >
          {viewMode === 'home' && <HomeView />}
          {viewMode === 'producer' && <ProducerView />}
          {viewMode === 'fan' && <FanView />}
          {viewMode === 'coach' && <CoachView />}
        </motion.div>
      </AnimatePresence>
      <GlobalDialogs />
    </>
  );
}
