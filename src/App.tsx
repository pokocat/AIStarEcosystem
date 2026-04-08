import { ThemeProvider } from './components/ThemeProvider';
import { AppShell } from './app/AppShell';
import { AppShellProvider } from './state/appShellStore';
import { GlobalAudioProvider } from './hooks/useGlobalAudio';

export default function App() {
  return (
    <ThemeProvider>
      <AppShellProvider>
        <GlobalAudioProvider>
          <AppShell />
        </GlobalAudioProvider>
      </AppShellProvider>
    </ThemeProvider>
  );
}
