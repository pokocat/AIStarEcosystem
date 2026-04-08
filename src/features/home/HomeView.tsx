import { Button } from '../../components/ui/button';
import { useAppShell } from '../../state/appShellStore';

export function HomeView() {
  const { setViewMode } = useAppShell();
  return (
    <div className="min-h-screen bg-[#07090f] text-white flex items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-black">AI Star Eco</h1>
        <p className="text-white/70">Foundation-First App Shell</p>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => setViewMode('producer')}>Producer</Button>
          <Button variant="outline" onClick={() => setViewMode('fan')}>Fan</Button>
          <Button variant="outline" onClick={() => setViewMode('coach')}>Coach</Button>
        </div>
      </div>
    </div>
  );
}
