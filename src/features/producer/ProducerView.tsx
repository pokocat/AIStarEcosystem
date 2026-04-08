import { motion, AnimatePresence } from 'motion/react';
import { ProducerSidebar } from './ProducerSidebar';
import { useAppShell } from '../../state/appShellStore';
import { StudioSection } from './sections/studio/StudioSection';

function Placeholder({ title }: { title: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-white text-xl font-semibold">{title}</div>;
}

export function ProducerView() {
  const { activeSection } = useAppShell();

  return (
    <div className="min-h-screen bg-[#06080d] flex">
      <ProducerSidebar />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.24 }}
          >
            {activeSection === 'studio' ? <StudioSection /> : <Placeholder title={`${activeSection} section`} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
