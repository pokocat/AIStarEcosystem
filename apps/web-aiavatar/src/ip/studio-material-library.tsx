'use client';
import { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { Images, UserRound, X } from 'lucide-react';
import type { IpSavedAsset } from '@ai-star-eco/types';
import { StudioIpLibrary, type StudioIpLibraryProps } from './studio-ip-library';
import { LibraryReferencePicker } from './library-reference-picker';
import { studioOverlayContainer } from './studio-overlay';

type Props = StudioIpLibraryProps & { projectId: string; onAssets: (assets: IpSavedAsset[]) => Promise<void> };
export function StudioMaterialLibrary(props: Props) {
  const [tab, setTab] = useState<'ip' | 'assets'>('ip'), [busy, setBusy] = useState(false);
  useEffect(() => { if (props.open) { setTab('ip'); setBusy(false); } }, [props.open]);
  const close = () => { if (!busy) props.onClose(); };
  return <Modal open={props.open} title="素材库" centered footer={null} width="min(1280px, calc(100vw - 48px))" className="studio-material-library-modal" getContainer={studioOverlayContainer} onCancel={close} closable={false} mask={{ closable: !busy }} keyboard={!busy} styles={{ container: { padding: 0, overflow: 'hidden' }, header: { display: 'none' }, body: { padding: 0 } }} destroyOnHidden>
    <div className="studio-material-library">
      <header className="studio-material-library-header"><div><h2>素材库</h2><p>选择已有素材，继续在画布创作</p></div><button type="button" aria-label="关闭素材库" disabled={busy} onClick={close}><X size={20}/></button></header>
      <nav className="studio-material-library-tabs" role="tablist" aria-label="素材库类别" onKeyDown={event=>{
        if(busy||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();const next=event.key==='Home'?'ip':event.key==='End'?'assets':tab==='ip'?'assets':'ip';setTab(next);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next==='ip'?0:1]?.focus();
      }}>
        <button type="button" id="studio-library-ip-tab" role="tab" tabIndex={tab==='ip'?0:-1} aria-selected={tab === 'ip'} aria-controls="studio-library-ip-panel" disabled={busy} onClick={() => setTab('ip')}><UserRound size={17}/>IP 人物</button>
        <button type="button" id="studio-library-assets-tab" role="tab" tabIndex={tab==='assets'?0:-1} aria-selected={tab === 'assets'} aria-controls="studio-library-assets-panel" disabled={busy} onClick={() => setTab('assets')}><Images size={17}/>素材资产</button>
      </nav>
      <section id={tab === 'ip' ? 'studio-library-ip-panel' : 'studio-library-assets-panel'} role="tabpanel" aria-labelledby={tab === 'ip' ? 'studio-library-ip-tab' : 'studio-library-assets-tab'} className="studio-material-library-content">
        {tab === 'ip' ? <StudioIpLibrary {...props} embedded onBusyChange={setBusy}/> : <LibraryReferencePicker embedded open={props.open} projectId={props.projectId} onClose={props.onClose} onAssets={props.onAssets} onBusyChange={setBusy}/>}
      </section>
    </div>
  </Modal>;
}
