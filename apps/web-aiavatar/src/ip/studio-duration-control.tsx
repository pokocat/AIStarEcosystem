"use client";
import { InputNumber } from "antd";
import { useId } from "react";
import { StudioChoiceGroup } from "./studio-generation-controls";

/** Native models accept every integer in their contract; legacy models keep their discrete list. */
export function StudioDurationControl({value,onChange,min,max,options=[]}:{
  value:number;onChange:(value:number)=>void;min?:number;max?:number;options?:number[];
}) {
  const id=useId(),continuous=min!=null&&max!=null;
  const presets=continuous?[5,8,10,15].filter(seconds=>seconds>=min&&seconds<=max):options;
  const choices=presets.length?presets:continuous?[...new Set([min,max])]:[];
  return <section className="studio-duration-control" aria-labelledby={id}>
    <header><h3 id={id}>时长</h3>{continuous&&min!==max&&<InputNumber aria-label="自定义视频时长" aria-describedby={`${id}-range`} value={value}
      min={min} max={max} precision={0} controls={false} suffix="秒" onChange={seconds=>{
        if(typeof seconds==='number'&&Number.isSafeInteger(seconds)&&seconds>=min&&seconds<=max)onChange(seconds);
      }}/>}</header>
    <StudioChoiceGroup<number> compact label="常用时长" ariaLabel="片段时长" value={value} onChange={onChange} options={choices.map(seconds=>({value:seconds,label:`${seconds} 秒`}))}/>
    {continuous&&min!==max&&<p id={`${id}-range`} className="studio-duration-range">支持 {min}–{max} 秒，可输入整数秒数</p>}
  </section>;
}
