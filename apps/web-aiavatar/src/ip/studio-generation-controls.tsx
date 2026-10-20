"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from "react";
import { Popover } from "antd";
import { ChevronDown, SlidersHorizontal, Sparkles, X } from "lucide-react";

const SettingsDisabled=createContext(false);
function focusPopup(panel:HTMLDivElement|null){
  const selected=panel?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]:not(:disabled)');
  const field=panel?.querySelector<HTMLElement>('input:not(:disabled),textarea:not(:disabled)');
  const action=panel?.querySelector<HTMLElement>('button:not(:disabled)');
  (selected||field||action)?.focus();
}
const popupContainer=(trigger:HTMLElement)=>trigger.closest<HTMLElement>(".ip-surface")||document.body;
function usePopupBounds(open:boolean,trigger:{current:HTMLButtonElement|null}){
  const [bounds,setBounds]=useState<{placement:"top"|"bottom";height:number}>({placement:"top",height:620});
  useLayoutEffect(()=>{
    if(!open)return;
    const measure=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;
      const above=rect.top-20,below=window.innerHeight-rect.bottom-20;
      const next={placement:above>=below?"top" as const:"bottom" as const,height:Math.max(160,Math.min(620,Math.max(above,below)))};
      setBounds(old=>old.height===next.height&&old.placement===next.placement?old:next);
    };
    measure();const frame=requestAnimationFrame(measure);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):undefined;if(trigger.current){observer?.observe(trigger.current);const footer=trigger.current.closest('.studio-floating-footer');if(footer)observer?.observe(footer);}
    window.addEventListener('resize',measure);return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',measure);};
  },[open,trigger]);
  return bounds;
}
export type StudioChoice<T extends string|number>={value:T;label:ReactNode;description?:string;disabled?:boolean};
/** A short, visible set of choices. Arrow keys follow the same order as the screen. */
export function StudioChoiceGroup<T extends string|number>({label,ariaLabel=label,value,options,onChange,ratios=false,compact=false,disabled=false}:{
  label:string;ariaLabel?:string;value?:T;options:StudioChoice<T>[];onChange:(value:T)=>void;ratios?:boolean;compact?:boolean;disabled?:boolean;
}) {
  const locked=useContext(SettingsDisabled)||disabled,id=useId();
  return <section className="studio-option-section" aria-labelledby={id}><h3 id={id}>{label}</h3>
    <div className={`studio-option-grid${ratios?' is-ratios':''}${compact?' is-compact':''}`} role="radiogroup" aria-label={ariaLabel} aria-disabled={locked||undefined}
      onKeyDown={e=>{
        if(locked||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;
        const choices=options.filter(o=>!o.disabled);if(!choices.length)return;e.preventDefault();
        const index=choices.findIndex(o=>o.value===value),step=e.key==="ArrowLeft"||e.key==="ArrowUp"?-1:1;
        const base=index<0?(step>0?-1:0):index;
        const next=e.key==="Home"?0:e.key==="End"?choices.length-1:(base+step+choices.length)%choices.length;
        onChange(choices[next].value);
        const button=e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')[next];button?.focus();
      }}>
      {options.map((option,index)=>{const selected=value===option.value;const [w,h]=String(option.value).split(":").map(Number);
        return <button key={option.value} type="button" role="radio" aria-checked={selected} disabled={locked||option.disabled}
          tabIndex={!locked&&!option.disabled&&(selected||!options.some(o=>o.value===value&&!o.disabled)&&index===options.findIndex(o=>!o.disabled))?0:-1} className="studio-option" title={option.description} aria-label={typeof option.label==='string'?[option.label,option.description].filter(Boolean).join(' '):undefined}
          onClick={()=>onChange(option.value)}>
          {ratios&&w>0&&h>0&&<span className="studio-ratio-preview" aria-hidden="true"><span style={{width:Math.round(26*w/Math.max(w,h)),height:Math.round(26*h/Math.max(w,h))}}/></span>}
          <span>{option.label}</span>{option.description&&<small>{option.description}</small>}
        </button>;
      })}
    </div>
  </section>;
}
export function studioImageSizeLabel(size?:string){
  if(!size)return undefined;
  const [w,h]=size.split('x').map(Number),edge=Math.max(w,h);
  return edge>=3840?'4K':edge>=1920?'2K':edge>=1024?'1K':size.replace('x',' × ');
}
/** Shared, non-modal settings surface. It stays open while values change. */
export function StudioSettingsPopover({summary,label="生成参数",children,disabled=false,open:controlled,onOpenChange}:{
  summary:ReactNode;label?:string;children:ReactNode;disabled?:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void;
}) {
  const [local,setLocal]=useState(false),open=controlled??local,trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
  const bounds=usePopupBounds(open,trigger);
  const change=(value:boolean)=>{setLocal(value);onOpenChange?.(value);};
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'))return;e.preventDefault();e.stopPropagation();change(false);trigger.current?.focus();}};window.addEventListener('keydown',close,true);return()=>window.removeEventListener('keydown',close,true);},[open]);
  return <Popover trigger="click" placement={bounds.placement} arrow={false} open={open&&!disabled} onOpenChange={change} afterOpenChange={visible=>{if(visible)focusPopup(panel.current);}} getPopupContainer={popupContainer} destroyOnHidden
    classNames={{root:"studio-settings-overlay"}} styles={{container:{padding:0}}} content={<SettingsDisabled.Provider value={disabled}><div ref={panel} id={id} style={{maxHeight:bounds.height}} className="studio-settings-popover nodrag nopan nowheel" role="region" aria-label={label}>
      <header><strong>{label}</strong><button type="button" aria-label={`收起${label}`} onClick={()=>{change(false);trigger.current?.focus();}}><X size={16}/></button></header>
      <fieldset disabled={disabled}>{children}</fieldset>
    </div></SettingsDisabled.Provider>}>
    <button ref={trigger} type="button" className="studio-settings-trigger" disabled={disabled} aria-expanded={open&&!disabled} aria-controls={open?id:undefined} aria-label={label}>
      <SlidersHorizontal size={15}/><span>{summary}</span><ChevronDown size={14} className={open?'is-open':undefined}/>
    </button>
  </Popover>;
}
export function StudioModelPicker({label="生成模型",value,options,onChange,disabled=false,loading=false}:{
  label?:string;value?:string;options:StudioChoice<string>[];onChange:(value:string)=>void;disabled?:boolean;loading?:boolean;
}) {
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const bounds=usePopupBounds(open,trigger);
  const selected=options.find(o=>o.value===value);
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}};window.addEventListener('keydown',close,true);return()=>window.removeEventListener('keydown',close,true);},[open]);
  return <Popover trigger="click" placement={bounds.placement} arrow={false} open={open&&!disabled} onOpenChange={setOpen} afterOpenChange={visible=>{if(visible)focusPopup(panel.current);}} getPopupContainer={popupContainer} destroyOnHidden
    classNames={{root:"studio-model-overlay"}} styles={{container:{padding:0}}} content={<div ref={panel} style={{maxHeight:Math.min(480,bounds.height)}} className="studio-model-menu"><StudioChoiceGroup label={label} value={value} options={options} onChange={next=>{onChange(next);setOpen(false);trigger.current?.focus();}}/></div>}>
    <button ref={trigger} type="button" className="studio-model-trigger" aria-label={label} aria-expanded={open&&!disabled} disabled={disabled||loading||!options.length} title={typeof selected?.label==='string'?selected.label:undefined}>
      <Sparkles size={16}/><span>{loading?'正在读取模型…':selected?.label||'尚未配置模型'}</span><ChevronDown size={14}/>
    </button>
  </Popover>;
}
