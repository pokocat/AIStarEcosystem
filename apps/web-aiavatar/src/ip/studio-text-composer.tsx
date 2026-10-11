"use client";

import { Input, Select } from 'antd';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import type { StudioCapabilities } from '@ai-star-eco/types/ip-studio-workflow';
import { StudioFloatingPanel } from './studio-floating-panel';

type Props = {
  open: boolean; embedded: boolean; nodeId?: string; value: string; onChange: (value: string) => void;
  model?: string; onModelChange: (model: string) => void; capabilities?: StudioCapabilities; cost?: number | null;
  busy: boolean; pending?: string; unknownTask?: boolean; onConfirm: () => void;
  onSubmit: () => void; onClose: () => void; summary?: string;
};

/** Intent is a draft message; typing never writes into the node's body. */
export function StudioTextComposer({open,embedded,nodeId,value,onChange,model,onModelChange,capabilities,cost,busy,pending,unknownTask,onConfirm,onSubmit,onClose,summary}:Props) {
  const options=capabilities?.textModels||[];
  const selected=(capabilities?.textModelMode!=='fixed'?options.find(m=>m.endpointId===model):undefined)||options.find(m=>m.isDefault)||options[0];
  const disabled=busy||!!pending||!value.trim()||value.length>16000||!capabilities||!capabilities.mock&&!selected;
  return <StudioFloatingPanel open={open} embedded={embedded} anchorId={nodeId} title="AI 修改文本" onClose={onClose} closable={!busy} className="studio-text-node-composer"
    footer={<>
      <Select aria-label="文本模型" value={selected?.endpointId} disabled={busy||!!pending||capabilities?.textModelMode==='fixed'} onChange={onModelChange} options={options.map(m=>({value:m.endpointId,label:m.name}))} placeholder="尚未配置文本模型"/>
      <div className="studio-text-submit-controls"><span>{capabilities?.mock?'测试响应 · 免费':cost==null?'未配置':`${cost} 积分`}</span>
        {unknownTask?<button type="button" className="studio-text-confirm" disabled={busy} onClick={onConfirm}>确认原任务</button>
          :<button type="button" className="studio-text-send" aria-label="发送修改要求" disabled={disabled} onClick={onSubmit}>{busy||pending?<LoaderCircle size={21} className="studio-text-spinner"/>:<ArrowUp size={23}/>}</button>}
      </div>
    </>}>
    <Input.TextArea aria-label="AI 修改要求" value={value} onChange={e=>onChange(e.target.value)} disabled={busy||!!pending} autoSize={{minRows:3,maxRows:7}} maxLength={16000}
      placeholder="告诉 AI 你想怎么改，例如：起一个标题、缩短这段、让语气更自然。"
      onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!e.nativeEvent.isComposing&&!disabled){e.preventDefault();onSubmit();}}}/>
    {(pending||summary)&&<p className="studio-text-feedback" role="status" aria-live="polite">{pending||summary}</p>}
  </StudioFloatingPanel>;
}
