"use client";
import { useEffect, useState } from "react";
import { Button, Input, Modal, Select } from "antd";
import type { StudioVoiceCatalog, StudioVoiceProfile } from "@ai-star-eco/types/ip-studio-workflow";
import { adoptStudioVoice, studioVoiceProfiles } from "@/canvas-bridge/studio-api";
import { SignedAudio } from "@/canvas-bridge/signed-audio";

type Props={open:boolean;projectId:string;runId?:string;title?:string;initialAvatarId?:string;audioUrl?:string;audioKey?:string;onClose:()=>void;onAdopt:(profile:StudioVoiceProfile)=>Promise<void>};
export function StudioVoiceAdopt({open,projectId,runId,title,initialAvatarId,audioUrl,audioKey,onClose,onAdopt}:Props){
  const [catalog,setCatalog]=useState<StudioVoiceCatalog>(),[avatarId,setAvatarId]=useState<string>(),[name,setName]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
  useEffect(()=>{if(!open)return;let active=true;setName(title||"人物声音");setAvatarId(initialAvatarId);setError("");setLoading(true);
    void studioVoiceProfiles().then(c=>{if(active)setCatalog(c);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[open,runId,title,initialAvatarId]);
  const person=catalog?.performers.find(a=>a.avatarId===avatarId),current=catalog?.profiles.find(v=>v.voiceId===person?.voiceId);
  const save=async()=>{if(!runId||!person||busy)return;setBusy(true);setError("");try{
    const profile=await adoptStudioVoice(projectId,{runId,avatarId:person.avatarId,name:name.trim(),expectedVoiceId:person.voiceId});await onAdopt(profile);onClose();
  }catch(e){setError(e instanceof Error?e.message:"人物声音未保存");}finally{setBusy(false);}};
  return <Modal title="设为人物声音" open={open} onCancel={busy?undefined:onClose} footer={null} getContainer={()=>document.querySelector<HTMLElement>(".ip-surface")||document.body}>
    <div className="studio-director-form"><p>将这段已完成配音的音色和风格保存为人物声音，设为默认。试听沿用真实音频，保存免费。</p>
      <SignedAudio src={audioUrl} storageKey={audioKey} controls/>
      {error&&<p role="alert">{error}<Button disabled={busy} onClick={()=>{setLoading(true);void studioVoiceProfiles().then(c=>{setCatalog(c);setError("");}).catch(e=>setError(e.message)).finally(()=>setLoading(false));}}>刷新人物声音</Button></p>}
      {!loading&&!catalog?.performers.length&&<p>先将人物图片加入 IP，再为人物保存声音。</p>}
      <label>所属人物<Select aria-label="声音所属人物" value={person?.avatarId} loading={loading} onChange={setAvatarId} placeholder="请选择人物" options={catalog?.performers.map(a=>({value:a.avatarId,label:a.name}))}/></label>
      {current&&<small>当前默认：{current.name} · v{current.version}。旧声音版本与旧作品保留。</small>}
      <label>声音名称<Input aria-label="声音名称" value={name} onChange={e=>setName(e.target.value)} maxLength={64}/></label>
      <p>保存的是官方预设音色版本，不表示声音克隆或训练。</p>
      <Button type="primary" loading={busy} disabled={loading||!person||!name.trim()||!runId} onClick={()=>void save()}>保存人物声音 · 免费</Button>
    </div>
  </Modal>;
}
