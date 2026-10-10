"use client";
import { useMemo, useRef, useState } from "react";
import { Button, Input, Popover } from "antd";
import { Move, Search } from "lucide-react";
import { CanvasPromptChipInput, type CanvasPromptChipInputHandle, type CanvasPromptChipInputProps } from "@/canvas/components/canvas/canvas-prompt-chip-input";
import { studioOverlayContainer } from "./studio-overlay";
import { StudioEffectLibrary, type StudioEffectPreview } from './studio-effect-library';
import type { StudioVideoEffect } from '@ai-star-eco/types';

// These are editable natural-language instructions, not supplier camera-control parameters.
// Full text is the single persisted value; every entry point reconstructs the same named chips from it.
export const studioCameraMotions = [
  { group:"推进与拉远", label:"缓慢推进", text:"镜头缓慢向前推进，逐渐靠近主体，保持主体在画面中央。" },
  { group:"推进与拉远", label:"缓慢拉远", text:"镜头缓慢向后拉远，从主体细节逐渐展现周围环境。" },
  { group:"横移与跟随", label:"向左横移", text:"镜头平稳向左横移，保持主体清晰，展现场景的空间层次。" },
  { group:"横移与跟随", label:"向右横移", text:"镜头平稳向右横移，保持主体清晰，展现场景的空间层次。" },
  { group:"横移与跟随", label:"跟随主体", text:"镜头平稳跟随主体移动，保持与主体的距离和构图。" },
  { group:"环绕与升降", label:"环绕主体", text:"镜头缓慢环绕主体，主体位置保持稳定，连续展现侧面与空间关系。" },
  { group:"环绕与升降", label:"镜头上升", text:"镜头平稳向上升起，从平视逐渐过渡到俯视，展现环境全貌。" },
  { group:"环绕与升降", label:"镜头下降", text:"镜头平稳向下降落，从高处逐渐接近主体，最终停在平视位置。" },
  { group:"固定与手持", label:"固定镜头", text:"镜头保持固定，构图和视角不变，由主体动作推动画面。" },
  { group:"固定与手持", label:"轻微手持", text:"镜头带有轻微自然的手持晃动，主体始终清晰可见，避免剧烈抖动。" },
] as const;

export function StudioMotionPrompt({ disabled = false, videoModel, effectPreviews, ...props }: CanvasPromptChipInputProps & { disabled?: boolean;videoModel?:string;effectPreviews?:StudioEffectPreview[] }) {
  const editor = useRef<CanvasPromptChipInputHandle>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState("");
  const [effects,setEffects]=useState<StudioVideoEffect[]>([]);
  const commands=useMemo(()=>[...studioCameraMotions,...effects.map(e=>({label:e.name,text:e.prompt}))],[effects]);
  const hasEffect = effects.some(effect => props.value.includes(effect.prompt));
  const matches = studioCameraMotions.filter(motion => `${motion.label} ${motion.group} ${motion.text}`.includes(query.trim()));
  const groups = [...new Set(matches.map(motion => motion.group))];
  return <div className="studio-motion-prompt" onKeyDown={event => { if(event.key!=="Escape")event.stopPropagation(); }}>
    <div className="studio-motion-tools">
      <Popover trigger="click" open={open} placement="topLeft" getPopupContainer={studioOverlayContainer} destroyOnHidden
        onOpenChange={next => { if (next) { editor.current?.rememberCaret(); setQuery(""); } setOpen(next); }}
        content={<div className="studio-motion-picker" role="dialog" aria-label="运镜指令"
          onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()}
          onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}
          onKeyDown={event => {
          event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
        }}>
          <Input autoFocus aria-label="搜索运镜指令" prefix={<Search size={15}/>} placeholder="搜索运镜" value={query} onChange={event=>setQuery(event.target.value)}/>
          <p>插入光标位置。点击标签可修改指令。</p>
          <div className="studio-motion-options">
            {groups.map(group => <section key={group}><h3>{group}</h3>{matches.filter(motion=>motion.group===group).map(motion =>
              <button key={motion.label} type="button" onClick={()=>{ editor.current?.insertCommand(motion); setOpen(false); }}>
                <strong>{motion.label}</strong><span>{motion.text}</span>
              </button>)}</section>)}
            {!matches.length && <p role="status">没有匹配的运镜，请换个关键词。</p>}
          </div>
        </div>}>
        <Button ref={trigger} disabled={disabled} type="text" size="small" aria-label="插入运镜指令" aria-expanded={open} onMouseDown={()=>editor.current?.rememberCaret()} icon={<Move size={14}/>}>运镜</Button>
      </Popover>
      {videoModel&&<StudioEffectLibrary model={videoModel} disabled={disabled} previews={effectPreviews} onCatalog={setEffects} hasEffect={hasEffect}
        onRememberCaret={()=>editor.current?.rememberCaret()} onApply={(effect,catalogue)=>editor.current?.insertCommand({label:effect.name,text:effect.prompt},{replaceCommands:catalogue.map(item=>({label:item.name,text:item.prompt}))})}/>}
      <span>{videoModel?'选择运镜或特效，也可直接描述画面':'选择运镜，或直接描述镜头运动'}</span>
    </div>
    <CanvasPromptChipInput {...props} ref={editor} commands={commands}/>
  </div>;
}
