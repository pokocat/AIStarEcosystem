"use client";
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { ApiError } from '@ai-star-eco/api-client';
import { auth } from '@/proto/api';
import type { StudioConversationSharePublic } from '@ai-star-eco/types/ip-studio-share';
import { readConversationShare,copyConversationShare } from '@/canvas-bridge/studio-share-api';
import { StudioConversationTranscript } from './studio-conversation-transcript';
const modes={general:'全能创作',original:'原创剧本',adapt:'故事改编',director:'分镜讨论'};
export function StudioConversationPublic({token}:{token:string}) {
  const router=useRouter();const [view,setView]=useState<StudioConversationSharePublic>(),[loading,setLoading]=useState(true),[error,setError]=useStudioErrorState(),[missing,setMissing]=useState(false),[copying,setCopying]=useState(false),[copyError,setCopyError]=useStudioErrorState();
  const request=useRef<{token:string;key:string}|undefined>(undefined),alive=useRef(true),lock=useRef(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;alive.current=true;setLoading(true);setError('');setMissing(false);
    readConversationShare(token).then(v=>{if(live)setView(v);}).catch(e=>{if(live){setMissing(e instanceof ApiError&&e.status===404);setError(e);}}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;alive.current=false;};
  },[token,retry]);
  const copy=async()=>{
    if(lock.current)return;
    if(!auth.isAuthed()){router.push(`/login?next=${encodeURIComponent(`/shared/conversations/${token}`)}`);return;}
    lock.current=true;setCopying(true);setCopyError('');
    try {if(request.current?.token!==token){let key:string|undefined;try{key=sessionStorage.getItem(`studio-share-copy:${token}`)||undefined;}catch{}request.current={token,key:key||nanoid()};try{sessionStorage.setItem(`studio-share-copy:${token}`,request.current.key);}catch{}}const p=await copyConversationShare(token,request.current.key);if(alive.current)router.push(`/projects/${encodeURIComponent(p.projectId)}?start=assistant`);}
    catch(e){if(alive.current){setCopyError(e);setCopying(false);}}
    finally{lock.current=false;}
  };
  return <main className="ip-surface studio-conversation-public">
    <header className="studio-share-brand"><a href="/">AI IP Studio</a><span>对话分享</span></header>
    <div className="studio-share-reading">
      {loading?<div className="studio-share-loading" aria-label="正在加载对话"><div/><div/><div/></div>:error?<section><h1>{missing?'分享链接已失效':'暂时无法打开对话'}</h1><p><StudioErrorNotice error={error}/></p>{!missing&&<button type="button" onClick={()=>setRetry(v=>v+1)}>重新加载</button>}<a href="/dashboard">进入 Studio</a></section>:view&&<>
        <div className="studio-share-heading"><h1>{view.snapshot.title}</h1><p>{modes[view.snapshot.mode]} · {new Date(view.createdAt).toLocaleString('zh-CN')}</p></div>
        <p className="studio-helper-note">这是分享时的对话快照，不含原画布素材。继续创作会复制到你的新画布，参考素材需重新选择；复制不会生成内容或扣积分。</p>
        <StudioConversationTranscript snapshot={view.snapshot}/>
        <footer className="studio-share-actions"><button className="studio-share-continue" type="button" disabled={copying} onClick={()=>void copy()}>{copying?'正在复制对话':'在 Studio 中继续创作'}</button><a href="/dashboard">进入 Studio</a></footer>
        {copyError&&<p className="studio-share-error"><StudioErrorNotice error={copyError}/></p>}
      </>}
    </div>
  </main>;
}
