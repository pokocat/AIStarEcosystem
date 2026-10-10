'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import type { IpTemplate } from '@ai-star-eco/types';
import { IpStudioApi } from './api';
import { StudioTemplateUse } from './studio-template-use';
import { studioOverlayContainer } from './studio-overlay';
import type { CanvasNodeData } from '@/canvas/types/canvas';

export function StudioTemplateLibrary({open,scope,nodes=[],onClose}:{open:boolean;scope:'all'|'commerce'|'digital';nodes?:CanvasNodeData[];onClose:()=>void}) {
  const router=useRouter();
  const [templates,setTemplates]=useState<IpTemplate[]>([]),[selected,setSelected]=useState<IpTemplate>();
  const [tab,setTab]=useState<'official'|'personal'>('official'),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{if(!open)return;let active=true;setLoading(true);setError('');setSelected(undefined);
    void IpStudioApi.listTemplates().then(items=>{if(active)setTemplates(items.filter(t=>!!t.versionId));}).catch(e=>{if(active)setError(e.message||'模板读取失败');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[open,refresh]);
  const items=templates.filter(t=>t.visibility===tab).sort((a,b)=>{
    const preferred=`IPD-studio-${scope}`;return Number(b.id===preferred)-Number(a.id===preferred);
  });
  return <>
    <Modal open={open&&!selected} title={scope==='commerce'?'商品视频模板':scope==='digital'?'数字人视频模板':'画布模板'} getContainer={studioOverlayContainer} onCancel={onClose} footer={<Button onClick={onClose}>返回画布</Button>} width={820} styles={{body:{maxHeight:'70dvh',overflowY:'auto'}}}>
      <div className="studio-template-form"><p>选择工作流，换成你的人物、商品与创作要求。先看制作计划，再逐步生成；完成后可以发布自己的模板。</p>
        <div role="group" aria-label="模板来源"><Button type={tab==='official'?'primary':'default'} onClick={()=>setTab('official')}>官方模板</Button> <Button type={tab==='personal'?'primary':'default'} onClick={()=>setTab('personal')}>我的模板</Button></div>
        {loading?<Spin aria-label="正在读取模板"/>:error?<Alert type="error" title={error} action={<Button onClick={()=>setRefresh(n=>n+1)}>重试</Button>}/>:items.length?<div className="studio-template-gallery">{items.map(t=><button type="button" key={t.id} className="studio-template-card" onClick={()=>setSelected(t)}><span>v{t.version} · {tab==='official'?'官方':'我的'}</span><strong>{t.name}</strong><p>{t.summary}</p><small>填写输入，预览制作计划 →</small></button>)}</div>:<p>{tab==='personal'?'还没有个人模板，可以在画布顶部发布。':'当前没有可用的官方模板。'}</p>}
      </div>
    </Modal>
    {selected&&open&&<StudioTemplateUse template={selected} nodes={nodes} onClose={()=>setSelected(undefined)} onCreated={id=>{onClose();router.push(`/projects/${id}`);}}/>}
  </>;
}
