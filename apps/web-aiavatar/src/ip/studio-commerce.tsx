"use client";
import { useEffect, useState } from "react";
import { App, Button, Drawer, Input, Select } from "antd";
import type { StudioAssetCatalog } from "@ai-star-eco/types/ip-studio-workflow";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { CanvasNodeType } from "@/canvas/types/canvas";
import { studioAssetCatalog } from "@/canvas-bridge/studio-api";
import { SignedImage } from "@/canvas-bridge/signed-image";

type Props={initialCharacterId?:string;onOpenIpLibrary:()=>void;open:boolean;onClose:()=>void;nodes:CanvasNodeData[];onDraft:(prompt:string,characterNodeId:string,productNodeId?:string,product?:StudioAssetCatalog["products"][number])=>void};
export function StudioCommerce({initialCharacterId,onOpenIpLibrary,open,onClose,nodes,onDraft}:Props) {
  const {message}=App.useApp();const [catalog,setCatalog]=useState<StudioAssetCatalog>(),[error,setError]=useState(""),[characterId,setCharacterId]=useState<string>(),[productId,setProductId]=useState<string>(),[name,setName]=useState(""),[points,setPoints]=useState(""),[template,setTemplate]=useState("实物介绍");
  const characters=nodes.filter(n=>n.type===CanvasNodeType.Image&&(n.metadata?.studio?.adoption||n.metadata?.studio?.references?.some(r=>r.avatarId)));
  const images=nodes.filter(n=>n.type===CanvasNodeType.Image&&n.metadata?.storageKey&&!characters.some(c=>c.id===n.id));
  const reload=()=>{setError("");void studioAssetCatalog().then(setCatalog).catch(e=>setError(e.message||"商品与声音状态未加载"));};
  useEffect(()=>{if(open)reload();},[open]);
  useEffect(()=>{if(initialCharacterId)setCharacterId(initialCharacterId);},[initialCharacterId]);
  const product=catalog?.products.find(p=>"asset:"+p.id===productId),productNode=images.find(n=>n.id===productId),character=characters.find(n=>n.id===characterId);
  const referencedPeople=[...new Set(character?.metadata?.studio?.references?.map(r=>r.avatarId).filter((id):id is string=>!!id)??[])];
  const avatarId=character?.metadata?.studio?.adoption?.avatarId??(referencedPeople.length===1?referencedPeople[0]:undefined);
  const persona=catalog?.performers.find(p=>p.avatarId===avatarId);
  return <Drawer title="IP 商品视频" open={open} onClose={onClose} size={520} getContainer={()=>document.querySelector<HTMLElement>(".ip-surface")||document.body}>
    <div className="studio-director-form"><p>确认角色、商品与卖点，先生成可修改的脚本，再进入同一故事板制作。</p>
      {error&&<p role="alert">{error}<Button onClick={reload}>重新加载</Button></p>}
      <Button onClick={onOpenIpLibrary}>从 IP 人物库选择出镜人物</Button>
      <label>画布出镜人物<Select aria-label="商品视频出镜 IP" value={characterId} onChange={setCharacterId} options={characters.map(n=>({value:n.id,label:n.title}))} placeholder="先在画布引用或定稿 IP"/></label>
      {character?.metadata?.content&&<SignedImage src={character.metadata.content} storageKey={character.metadata.storageKey} alt={character.title} style={{height:150,objectFit:"contain"}}/>}
      {character&&!avatarId&&<p>这张图片引用了多个人物，请选择一个明确的出镜 IP。</p>}
      {persona&&<p>主形象：{persona.imageReady?"已定稿":"未完成"}；训练形象驱动：{({unavailable:"未配置",not_created:"未创建",training:"训练中",ready:"已就绪",failed:"训练失败"})[persona.driverStatus]}。{catalog?.videoLipSyncReady&&"可在画布“口型同步”入口选择人物视频与配音。"}{!catalog?.voiceEngineReady&&"专属音色尚未配置，可在“配音”入口查看官方固定音色。"}</p>}
      <label>商品素材<Select aria-label="商品素材" value={productId} onChange={id=>{setProductId(id);const p=catalog?.products.find(p=>"asset:"+p.id===id);setName(p?.name||images.find(n=>n.id===id)?.title||"");setPoints(p?.description||"");}} options={[...(catalog?.products||[]).filter(p=>p.storageKey).map(p=>({value:"asset:"+p.id,label:`商品资产 · ${p.name}`})),...images.map(n=>({value:n.id,label:`画布素材 · ${n.title}`}))]} placeholder="选择商品资产或已上传的商品图"/></label>
      {(product?.url||productNode?.metadata?.content)&&<SignedImage src={product?.url||productNode?.metadata?.content} storageKey={product?.storageKey||productNode?.metadata?.storageKey} alt="商品参考" style={{height:150,objectFit:"contain"}}/>}
      <label>商品名称<Input aria-label="商品名称" value={name} onChange={e=>setName(e.target.value)} maxLength={120}/></label>
      <label>已确认卖点<Input.TextArea aria-label="已确认商品卖点" value={points} onChange={e=>setPoints(e.target.value)} rows={5} maxLength={2000} placeholder="只填写可确认的商品特点，不确定的价格或功效留空"/></label>
      <label>脚本方案<Select aria-label="商品视频脚本方案" value={template} onChange={setTemplate} options={["实物介绍","场景演示","故事植入"].map(v=>({value:v,label:v}))}/></label>
      <p>视频先使用图像驱动方式；模型自带音轨与专属声音分开。字幕和品牌文字可在合成时添加。</p>
      <Button type="primary" disabled={!character||!avatarId||!productId||!name.trim()||!points.trim()} onClick={()=>{if(!character||!avatarId)return;onDraft(`为所选 IP 和商品创作一条商品介绍短视频。方案：${template}。商品名称：${name.trim()}。已确认卖点：${points.trim()}。只使用这些已确认信息，不编造价格、功效、承诺或品牌授权。30秒，3镜，保持出镜人物与商品一致。正文含可编辑台词，镜头清楚描述人物如何展示商品。`,character.id,productNode?.id,product);onClose();message.info("请确认脚本参数和费用");}}>起草商品视频脚本</Button>
    </div>
  </Drawer>;
}
