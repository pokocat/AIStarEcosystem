"use client";
import { InputNumber } from "antd";
import { useId, useState } from "react";
import { StudioChoiceGroup } from "./studio-generation-controls";

/** Model bounds allow integer seconds; without bounds, keep the supplied discrete list. */
export function StudioDurationControl({value,onChange,min,max,options=[],label="时长"}:{
  value:number;onChange:(value:number)=>void;min?:number;max?:number;options?:number[];label?:string;
}) {
  const id=useId(),continuous=min!=null&&max!=null,inRange=continuous&&value>=min&&value<=max;
  const [inputReset,setInputReset]=useState(0);
  // Include both contract endpoints so longer models never look capped at the old 15-second preset.
  const choices=continuous?[...new Set([min,5,8,10,15,max])].filter(seconds=>seconds>=min&&seconds<=max).sort((a,b)=>a-b):options;
  return <section className="studio-duration-control" aria-labelledby={id}>
    <header><h3 id={id}>{label}</h3>{continuous&&min!==max&&<InputNumber key={inputReset} aria-label="自定义视频时长" aria-describedby={`${id}-range`} value={value}
      // A value out of range comes from switching models. Leaving the field must not clamp it: only the visible fix may
      // change what is charged. The remount drops anything out of range that was typed but not accepted.
      changeOnBlur={inRange} onBlur={()=>{if(!inRange)setInputReset(n=>n+1);}}
      min={min} max={max} precision={0} controls={false} suffix="秒" onChange={seconds=>{
        if(typeof seconds==='number'&&Number.isSafeInteger(seconds)&&seconds>=min&&seconds<=max)onChange(seconds);
      }}/>}</header>
    <StudioChoiceGroup<number> compact label="常用时长" ariaLabel="片段时长" value={value} onChange={onChange} options={choices.map(seconds=>({value:seconds,label:`${seconds} 秒`}))}/>
    {continuous&&min!==max&&<p id={`${id}-range`} className="studio-duration-range">支持 {min}–{max} 秒，可输入整数秒数</p>}
  </section>;
}
