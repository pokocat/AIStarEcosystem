"use client";
import {Input,Select} from "antd";
import type {StudioScriptSettings} from "@ai-star-eco/types/ip-studio-workflow";
const genres=["都市治愈","都市情感","古装幻想","悬疑","喜剧","科幻","生活分享","商品介绍"];
/** The authoring panel and completed-script editor use the same editable settings. */
export function StudioScriptSettingsForm({value,onChange}:{value:StudioScriptSettings;onChange:(value:StudioScriptSettings)=>void}) {
  const change=(next:Partial<StudioScriptSettings>)=>onChange({...value,...next});
  return <div className="studio-setting-list">
    <div className="studio-settings-grid">
      <label>题材<Select aria-label="剧本题材" placeholder="选择题材" value={value.genre} onChange={genre=>change({genre})} options={genres.map(v=>({value:v,label:v}))}/></label>
      <label>集数<Select aria-label="目标集数" value={value.episodeCount||1} onChange={episodeCount=>change({episodeCount})} options={[1,2,3,4,5,6].map(v=>({value:v,label:`${v} 集`}))}/></label>
      <label>每集目标时长<Select aria-label="每集目标时长" value={value.episodeDurationSec||30} onChange={episodeDurationSec=>change({episodeDurationSec})} options={[10,15,30,60,120].map(v=>({value:v,label:`${v} 秒`}))}/></label>
    </div>
    <label>融合题材<Select aria-label="融合题材" mode="multiple" maxCount={3} value={value.fusionGenres||[]} onChange={fusionGenres=>change({fusionGenres})} options={genres.filter(v=>v!==value.genre).map(v=>({value:v,label:v}))} placeholder="可选，最多 3 种"/></label>
    {(["audience","era","characterBrief","core","structure","style"] as const).map((key,i)=><label key={key}>{["目标观众","时代背景","人物与关系","核心看点","叙事结构","画面风格"][i]}<Input.TextArea aria-label={["目标观众","时代背景","人物与关系","核心看点","叙事结构","画面风格"][i]} value={value[key]} maxLength={1000} autoSize={{minRows:2,maxRows:4}} onChange={e=>change({[key]:e.target.value})}/></label>)}
  </div>;
}
