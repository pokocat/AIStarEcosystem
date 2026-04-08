import { motion } from 'motion/react';
import type { ComponentType } from 'react';
import { LayoutDashboard, Sparkles, Music2, Scissors, Coins, Globe, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../components/ui/utils';
import { useAppShell } from '../../state/appShellStore';
import type { ActiveSection } from '../../types/entities';

const NAV_ITEMS: Array<{ key: ActiveSection; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: '经纪大盘', icon: LayoutDashboard },
  { key: 'incubator', label: 'AI歌手孵化', icon: Sparkles },
  { key: 'studio', label: '音乐与MV工坊', icon: Music2 },
  { key: 'editor', label: '高级编辑器', icon: Scissors },
  { key: 'mint', label: '链上资产', icon: Coins },
  { key: 'distribution', label: '发行运营', icon: Globe },
  { key: 'community', label: '粉丝社群', icon: Users },
];

export function ProducerSidebar() {
  const { activeSection, setActiveSection } = useAppShell();

  return (
    <aside className="w-72 shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl p-4 sticky top-0 h-screen">
      <div className="mb-6 px-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Producer Console</p>
        <h2 className="text-xl font-bold text-white">AI Star Eco</h2>
      </div>
      <nav className="space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.key;
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              variant="ghost"
              onClick={() => setActiveSection(item.key)}
              className={cn('relative w-full justify-start gap-3 text-white/80 hover:text-white hover:bg-white/10', isActive && 'text-white bg-white/15')}
            >
              {isActive && (
                <motion.span
                  layoutId="producer-sidebar-active"
                  className="absolute inset-0 rounded-md border border-cyan-300/40"
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                />
              )}
              <Icon className="size-4" />
              <span className="relative">{item.label}</span>
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
