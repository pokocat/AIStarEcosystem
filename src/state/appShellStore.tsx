import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { ActiveSection, ViewMode } from '../types/entities';

export type GlobalDialogKey =
  | 'musicGeneration'
  | 'nftMinting'
  | 'artistSigning'
  | 'artistDetail'
  | 'artistListing'
  | 'onboarding';

type DialogState = Record<GlobalDialogKey, boolean>;

interface AppShellContextValue {
  viewMode: ViewMode;
  setViewMode: (view: ViewMode) => void;
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
  dialogs: DialogState;
  openDialog: (key: GlobalDialogKey) => void;
  closeDialog: (key: GlobalDialogKey) => void;
}

const defaultDialogs: DialogState = {
  musicGeneration: false,
  nftMinting: false,
  artistSigning: false,
  artistDetail: false,
  artistListing: false,
  onboarding: false,
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: PropsWithChildren) {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [dialogs, setDialogs] = useState<DialogState>(defaultDialogs);

  const value = useMemo<AppShellContextValue>(
    () => ({
      viewMode,
      setViewMode,
      activeSection,
      setActiveSection,
      dialogs,
      openDialog: (key) => setDialogs((prev) => ({ ...prev, [key]: true })),
      closeDialog: (key) => setDialogs((prev) => ({ ...prev, [key]: false })),
    }),
    [viewMode, activeSection, dialogs],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used inside AppShellProvider');
  }
  return context;
}
