"use client";
import { StudioFloatingPanel } from "./studio-floating-panel";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Select } from "antd";
import type { StudioSpeechCatalog, StudioSpeechRequest, StudioVoiceCatalog, StudioNodeMetadata } from "@ai-star-eco/types/ip-studio-workflow";
import { bindStudioVoice, studioSpeechCatalog, studioVoiceProfiles } from "@/canvas-bridge/studio-api";
import { SignedAudio } from "@/canvas-bridge/signed-audio";

type Props={anchorId?:string;open:boolean;onClose:()=>void;initialText:string;initialAvatarId?:string;initialVoiceId?:string;initialDraft?:StudioNodeMetadata['speechDraft'];onDraft?:(draft:NonNullable<StudioNodeMetadata['speechDraft']>)=>void;pending?:{confirmed:boolean};onConfirm?:()=>void;busy:boolean;onSubmit:(request:Omit<StudioSpeechRequest,"clientRequestId"|"nodeId">)=>Promise<void>};
export function StudioSpeech({anchorId,open,onClose,initialText,initialAvatarId,initialVoiceId,initialDraft,onDraft,pending,onConfirm,busy,onSubmit}:Props) {
  const [catalog,setCatalog]=useState<StudioSpeechCatalog>(),[profiles,setProfiles]=useState<StudioVoiceCatalog>(),[error,setError]=useState(""),[loading,setLoading]=useState(false),[binding,setBinding]=useState(false);
  const [model,setModel]=useState<string>(),[speaker,setSpeaker]=useState("Vivian"),[text,setText]=useState(""),[instruct,setInstruct]=useState("");
  const [avatarId,setAvatarId]=useState<string>(),[voiceId,setVoiceId]=useState<string>(),[notice,setNotice]=useState("");
  const [ready,setReady]=useState(false);
  const seed=useRef({initialText,initialAvatarId,initialVoiceId,initialDraft});seed.current={initialText,initialAvatarId,initialVoiceId,initialDraft};
  const reload=async()=>{setLoading(true);setError("");try{const [c,p]=await Promise.all([studioSpeechCatalog(),studioVoiceProfiles()]);setCatalog(c);setProfiles(p);}catch(e){setError(e instanceof Error?e.message:"配音模型与人物声音未加载");}finally{setLoading(false);}};
  useEffect(()=>{
    if(!open)return;let active=true;const initial=seed.current,draft=initial.initialDraft;setReady(false);setText(draft?.text??initial.initialText);setNotice("");setLoading(true);setError("");
    void Promise.all([studioSpeechCatalog(),studioVoiceProfiles()]).then(([c,p])=>{
      if(!active)return;setCatalog(c);setProfiles(p);setModel(draft?.model);
      const person=p.performers.find(a=>a.avatarId===(draft?.avatarId??initial.initialAvatarId)),voice=p.profiles.find(v=>v.voiceId===(draft?draft.voiceId:initial.initialVoiceId||person?.voiceId)&&v.avatarId===person?.avatarId);
      setAvatarId(person?.avatarId);setVoiceId(voice?.voiceId);setSpeaker(voice?.speaker||draft?.speaker||c.voices[0]?.speaker||"Vivian");setInstruct(voice?.instruct||draft?.instruct||"");setReady(true);
    }).catch(e=>{if(active)setError(e.message||"配音模型与人物声音未加载");}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[open,anchorId]);
  const selected=catalog?.models.find(m=>m.endpointId===model)||catalog?.models.find(m=>m.isDefault)||catalog?.models[0];
  useEffect(()=>{if(open&&ready&&selected&&!pending)onDraft?.({model:selected.endpointId,text,speaker,instruct:instruct||undefined,avatarId,voiceId});},[open,ready,selected?.endpointId,text,speaker,instruct,avatarId,voiceId,onDraft,!!pending]);
  const voice=catalog?.voices.find(v=>v.speaker===speaker),rate=selected?.creditCostPerSecond;
  const cost=rate==null?selected?.creditCost:Math.ceil(Math.min(600,Math.max(10,Array.from(text.trim()).length+10))*rate);
  const person=profiles?.performers.find(a=>a.avatarId===avatarId),profile=profiles?.profiles.find(v=>v.voiceId===voiceId&&v.avatarId===avatarId);
  const selectProfile=(id?:string)=>{const v=profiles?.profiles.find(v=>v.voiceId===id);setVoiceId(v?.voiceId);if(v){setSpeaker(v.speaker);setInstruct(v.instruct||"");}};
  const selectPerson=(id?:string)=>{setAvatarId(id);selectProfile(profiles?.performers.find(a=>a.avatarId===id)?.voiceId);setNotice("");};
  return <StudioFloatingPanel title="人物配音" open={open} onClose={busy||binding?undefined:onClose} width={520} anchorId={anchorId} footer={<div className="studio-speech-footer">
    {pending?<><p role="status">{pending.confirmed?'原配音任务正在生成，请等待结果。':'配音提交结果尚未确认，请确认原任务。'}</p><Button type="primary" loading={busy} onClick={onConfirm}>{pending.confirmed?'查看原任务':'确认原任务'}</Button></>:<Button type="primary" loading={busy} disabled={loading||binding||!!error||!selected||!voice||cost==null||!text.trim()} onClick={()=>{if(selected&&cost!=null)void onSubmit({model:selected.endpointId,speaker,text:text.trim(),instruct:instruct.trim()||undefined,maxCost:cost,...(avatarId?{avatarId}:{}),...(profile?{voiceId:profile.voiceId}:{})});}}>
      {cost==null?"配音费用未配置":rate==null?`生成配音 · ${cost} 积分`:`生成配音 · 预冻结 ${cost} 积分`}
    </Button>}
  </div>}>
    <div className="studio-director-form">{rate!=null&&<p role="status">{rate} 积分/秒，按生成音频的实际时长向上取整计费。预冻结 {cost} 积分，完成后退回差额，不会超出本次上限。</p>}<p>指定人物与声音版本，为台词或商品介绍生成配音。音频会保存在当前画布，可试听、下载并用于成片。</p>
      {error&&<p role="alert">{error}<Button onClick={()=>void reload()}>重新加载</Button></p>}
      {notice&&<p role="status">{notice}</p>}
      {!loading&&!error&&!catalog?.models.length&&<p role="status">尚未配置配音模型，请在后台绑定「Studio 配音」。</p>}
      <label>配音人物<Select aria-label="配音人物" allowClear value={avatarId} onChange={selectPerson} placeholder="选择人物（可选）" options={profiles?.performers.map(a=>({value:a.avatarId,label:a.name}))}/></label>
      {person&&<label>声音版本<Select aria-label="声音版本" value={profile?.voiceId||"temporary"} onChange={id=>selectProfile(id==="temporary"?undefined:id)} options={[{value:"temporary",label:"临时固定音色"},...(profiles?.profiles.filter(v=>v.avatarId===avatarId).map(v=>({value:v.voiceId,label:`${v.name} · v${v.version}${v.voiceId===person.voiceId?" · 默认":""}`}))||[])]}/></label>}
      {profile&&<><small>本次使用 {profile.name} · v{profile.version}。人物默认声音改变后，此任务仍保留当前版本。</small><SignedAudio src={profile.demoUrl} storageKey={profile.demoStorageKey} controls/>
        {profile.voiceId!==person?.voiceId&&<Button loading={binding} disabled={busy} onClick={()=>{if(!person)return;setBinding(true);setError("");void bindStudioVoice(person.avatarId,{voiceId:profile.voiceId,expectedVoiceId:person.voiceId}).then(()=>studioVoiceProfiles()).then(p=>{setProfiles(p);setNotice(`已设为 ${person.name} 的默认声音；旧作品保留原版本。`);}).catch(e=>setError(e.message)).finally(()=>setBinding(false));}}>设为人物默认声音 · 免费</Button>}</>}
      <label>配音模型<Select aria-label="配音模型" loading={loading} value={selected?.endpointId} onChange={setModel} options={catalog?.models.map(m=>({value:m.endpointId,label:m.name}))}/></label>
      <label>固定音色<Select aria-label="固定音色" disabled={!!profile} value={speaker} onChange={setSpeaker} options={catalog?.voices.map(v=>({value:v.speaker,label:`${v.name} · ${v.language}`}))}/></label>
      {voice&&<small>{voice.description}</small>}
      <label>配音正文<Input.TextArea aria-label="配音正文" value={text} onChange={e=>setText(e.target.value)} rows={7} maxLength={catalog?.maxTextLength||600} showCount placeholder="只填写要读出的台词，用标点控制停顿"/></label>
      <label>声音风格（可选）<Input.TextArea aria-label="声音风格" disabled={!!profile} value={instruct} onChange={e=>setInstruct(e.target.value)} rows={2} maxLength={catalog?.maxInstructLength||160} placeholder="例如：温暖自然，像朋友一样介绍"/></label>
      <details><summary>声音版本说明</summary><p>{profile?"要调整音色或风格，请选择临时固定音色；生成满意后可保存为新声音版本。":"临时音色不会改变人物默认声音。生成满意后，选中音频并点击“设为人物声音”，保存音色、风格和真实试听。"}官方预设音色无需训练；专属声音克隆仍需接入。</p></details>
    </div>
  </StudioFloatingPanel>;
}
