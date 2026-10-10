"use client";
import { useEffect,useRef,useState } from 'react';
import { Button,Input,Modal,Skeleton } from 'antd';
import { Share2 } from 'lucide-react';
import type { StudioConversationSharePreview } from '@ai-star-eco/types/ip-studio-share';
import { previewConversationShare,createConversationShare,revokeConversationShare } from '@/canvas-bridge/studio-share-api';
import { saveStudioDocument } from '@/canvas-bridge/studio-save';
import { StudioConversationTranscript } from './studio-conversation-transcript';
import { studioOverlayContainer } from './studio-overlay';

export function StudioConversationShare({projectId,nodeId,disabled}:{projectId:string;nodeId?:string;disabled:boolean}) {
  const [open,setOpen]=useState(false),[preview,setPreview]=useState<StudioConversationSharePreview>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const alive=useRef(true),inFlight=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const load=async()=>{
    if(!nodeId||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');
    try { await saveStudioDocument(projectId);const value=await previewConversationShare(projectId,nodeId);if(alive.current)setPreview(value); }
    catch(e){if(alive.current)setError(e instanceof Error?e.message:'对话暂时无法预览，请重试');}
    finally{inFlight.current=false;if(alive.current)setBusy(false);}
  };
  const change=async(revoke=false)=>{
    if(!nodeId||!preview||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');
    try {
      if(revoke&&preview.share){await revokeConversationShare(projectId,nodeId,preview.share.token);if(alive.current){setPreview({...preview,share:undefined});setNotice('已撤销，原链接无法再查看');}}
      else {const share=await createConversationShare(projectId,nodeId,preview.snapshotHash);if(alive.current){setPreview({...preview,share});setNotice('分享链接已创建，可复制后发送');}}
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'操作未完成，请确认后重试');}
    finally{inFlight.current=false;if(alive.current)setBusy(false);}
  };
  const url=preview?.share?`${typeof window==='undefined'?'':window.location.origin}${preview.share.path}`:'';
  return <>
    <Button aria-label="分享对话" title={disabled?'完成一轮对话后可分享':'预览并分享这次对话'} icon={<Share2 size={16}/>} disabled={disabled||!nodeId} onClick={()=>{setOpen(true);setPreview(undefined);void load();}}>分享</Button>
    <Modal title="分享对话" open={open} onCancel={()=>{if(!busy)setOpen(false);}} closable={!busy} maskClosable={!busy} getContainer={studioOverlayContainer} footer={null} width={680} style={{top:24}} styles={{body:{maxHeight:'calc(100dvh - 112px)',overflowY:'auto'}}}>
      <div className="studio-conversation-share">
        <p className="studio-helper-note">任何获得链接的人都可查看以下对话和创作建议。链接保存本次快照，不含画布图片、视频和音频，也不会自动同步后续消息。</p>
        {busy&&!preview&&<Skeleton active paragraph={{rows:5}}/>}
        {preview&&<><h3>{preview.snapshot.title}</h3><div className="studio-share-preview" aria-label="将分享的对话内容"><StudioConversationTranscript snapshot={preview.snapshot}/></div>
          {preview.share&&<><p className="studio-helper-note">链接不会自动同步。预览新内容后更新快照，旧链接才会失效；内容相同会保留原链接。</p><Input aria-label="对话分享链接" readOnly value={url}/><div className="studio-share-actions"><Button disabled={busy} onClick={()=>void navigator.clipboard.writeText(url).then(()=>setNotice('链接已复制')).catch(()=>setError('无法复制，请选择链接并手动复制'))}>复制链接</Button><a href={preview.share.path} target="_blank" rel="noopener noreferrer">查看分享页</a><Button danger disabled={busy} onClick={()=>void change(true)}>撤销分享</Button></div></>}
        </>}
        {error&&<p role="alert" className="studio-share-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
        <div className="studio-share-actions"><Button disabled={busy} onClick={()=>setOpen(false)}>返回对话</Button><Button disabled={busy} onClick={()=>void load()}>重新预览</Button>{preview&&<Button className="studio-assistant-primary" loading={busy} onClick={()=>void change()}>{preview.share?'更新分享快照':'创建分享链接'}</Button>}</div>
      </div>
    </Modal>
  </>;
}
