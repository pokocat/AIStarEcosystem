import { Button } from '../../components/ui/button';
import { useAppShell } from '../../state/appShellStore';

export function FanView() {
  const { setViewMode } = useAppShell();
  return (
    <div className="p-8 text-white">
      <h2 className="text-2xl font-bold mb-2">Fan Portal</h2>
      <Button onClick={() => setViewMode('home')}>返回首页</Button>
    </div>
  );
}
