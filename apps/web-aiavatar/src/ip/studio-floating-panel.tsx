'use client';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PanelRight, PanelRightClose, X } from 'lucide-react';

// Screen-space chrome lives outside React Flow's scaled viewport. Context changes
// remeasure the anchor on pan, zoom and node drag without polling the DOM.
export const StudioFloatingContext = createContext<unknown>(undefined);
type Rect = { left:number; top:number; width:number; height:number };
export function floatingPosition(stage:Rect, anchor:Rect|undefined, panel:{width:number;height:number}, above=false) {
  const gap=12, topBound=72, leftBound=72, rightBound=stage.width-16-panel.width, bottomBound=stage.height-68-panel.height;
  const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(v,Math.max(min,max)));
  if(!anchor)return {left:clamp(stage.width-panel.width-24,leftBound,rightBound),top:clamp(topBound,topBound,bottomBound)};
  const x=anchor.left-stage.left, y=anchor.top-stage.top;
  let left=x+anchor.width/2-panel.width/2, top=above?y-panel.height-gap:y+anchor.height+gap;
  if(!above&&top>bottomBound) {
    // Prefer a clear side when there is no room below; never cover the node
    // simply because the canvas is zoomed in.
    if(x+anchor.width+gap+panel.width<=stage.width-16){left=x+anchor.width+gap;top=y;}
    else if(x-gap-panel.width>=leftBound){left=x-panel.width-gap;top=y;}
    else if(y-panel.height-gap>=topBound)top=y-panel.height-gap;
  }
  return {left:clamp(left,leftBound,rightBound),top:clamp(top,topBound,bottomBound)};
}
type Props={open:boolean;title?:ReactNode;anchorId?:string;width?:number;children:ReactNode;footer?:ReactNode;
  onClose?:()=>void;closable?:boolean;utility?:boolean;dockable?:boolean;above?:boolean;className?:string};
type FloatingEntry={id:symbol;root:HTMLElement;update:(layer:number,active:boolean)=>void};
// One bounded stack per canvas stage. Popups remain above it; closed entries are removed.
const floatingStack:FloatingEntry[]=[];
function refreshStack(root:HTMLElement) {
  const entries=floatingStack.filter(entry=>entry.root===root);
  entries.forEach((entry,index)=>entry.update(90+index,index===entries.length-1));
}
function raiseFloating(id:symbol) {
  const index=floatingStack.findIndex(entry=>entry.id===id);
  if(index<0)return;
  const entry=floatingStack[index];
  if(floatingStack.filter(item=>item.root===entry.root).at(-1)===entry)return;
  floatingStack.splice(index,1);floatingStack.push(entry);refreshStack(entry.root);
}
export function StudioFloatingPanel({open,title,anchorId,width=660,children,footer,onClose,closable=true,utility=false,dockable=false,above=false,className=''}:Props) {
  const revision=useContext(StudioFloatingContext), ref=useRef<HTMLElement>(null);
  const identity=useRef(Symbol('floating-panel')),[layer,setLayer]=useState({z:90,active:false});
  const [root,setRoot]=useState<HTMLElement|null>(null),[position,setPosition]=useState({left:0,top:0}),[docked,setDocked]=useState(false);
  const [manual,setManual]=useState<{left:number;top:number}>(),drag=useRef<{x:number;y:number;left:number;top:number}|undefined>(undefined);
  useLayoutEffect(()=>{if(open)setRoot(document.querySelector<HTMLElement>('[data-studio-floating-root]')||document.querySelector<HTMLElement>('.ip-surface'));},[open]);
  useLayoutEffect(()=>{
    if(!open||!root||!ref.current)return;
    const place=()=>{
      if(!ref.current)return;const stage=root.getBoundingClientRect(),panel=ref.current.getBoundingClientRect();
      const anchor=anchorId?root.querySelector<HTMLElement>(`[data-id="${CSS.escape(anchorId)}"]`)?.getBoundingClientRect():undefined;
      const next=floatingPosition(stage,utility?undefined:anchor,panel,above);
      if(!utility&&anchor&&!above) {
        for(const sibling of root.querySelectorAll<HTMLElement>('.studio-floating-panel.is-utility')) {
          const other=sibling.getBoundingClientRect(),left=other.left-stage.left,top=other.top-stage.top;
          if(next.left<left+other.width&&next.left+panel.width>left&&next.top<top+other.height&&next.top+panel.height>top) {
            if(left-panel.width-12>=72)next.left=Math.min(next.left,left-panel.width-12);
            else if(left+other.width+12+panel.width<=stage.width-16)next.left=left+other.width+12;
          }
        }
      }
      if(manual&&!docked){next.left=Math.max(72,Math.min(manual.left,stage.width-panel.width-16));next.top=Math.max(72,Math.min(manual.top,stage.height-panel.height-68));}
      setPosition(old=>old.left===next.left&&old.top===next.top?old:next);
    };
    place();const observer=new ResizeObserver(place);observer.observe(root);observer.observe(ref.current);
    return()=>observer.disconnect();
  },[open,root,anchorId,revision,manual,docked,utility,above]);
  useEffect(()=>{setManual(undefined);},[anchorId]);
  useLayoutEffect(()=>{
    if(!open||!root||!title)return;
    const entry:FloatingEntry={id:identity.current,root,update:(z,active)=>setLayer({z,active})};
    floatingStack.push(entry);refreshStack(root);
    return()=>{const index=floatingStack.indexOf(entry);if(index>=0)floatingStack.splice(index,1);refreshStack(root);};
  },[open,root,!!title]);
  useEffect(()=>{
    if(!open||!onClose||!closable)return;
    const escape=(e:KeyboardEvent)=>{
      if(e.key!=='Escape'||e.defaultPrevented||!title||floatingStack.filter(entry=>entry.root===root).at(-1)?.id!==identity.current)return;
      // Inner editors and Antd menus own their first Escape. Expanded modals protect focus.
      if(document.querySelector('.ant-modal-wrap:not([style*="display: none"]),.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-popover:not(.ant-popover-hidden)'))return;
      e.preventDefault();onClose();
    };
    document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
  },[open,onClose,closable,root,!!title]);
  if(!open||!root)return null;
  return createPortal(<section ref={ref} className={`studio-floating-panel nodrag nopan nowheel${utility?' is-utility':''}${docked?' is-docked':''}${above?' is-context-toolbar':''} ${className}`}
    role={title?'dialog':undefined} aria-modal={title?false:undefined} aria-label={typeof title==='string'?title:undefined} data-anchor-id={anchorId} data-active={title?layer.active:undefined}
    onPointerDownCapture={()=>raiseFloating(identity.current)} onFocusCapture={()=>raiseFloating(identity.current)}
    style={{width,left:docked?undefined:position.left,top:docked?undefined:position.top,zIndex:title?layer.z:undefined}}>
    {title&&<header className={`studio-floating-header${utility?' is-draggable':''}`} onPointerDown={e=>{
      if(!utility||docked||(e.target as HTMLElement).closest('button'))return;
      drag.current={x:e.clientX,y:e.clientY,...position};e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e=>{if(drag.current)setManual({left:drag.current.left+e.clientX-drag.current.x,top:drag.current.top+e.clientY-drag.current.y});}}
    onPointerUp={()=>{drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}}>
      <strong>{title}</strong><div>{dockable&&<button type="button" aria-label={docked?'返回浮窗':'停靠到右侧'} title={docked?'返回浮窗':'停靠到右侧'} onClick={()=>setDocked(v=>!v)}>{docked?<PanelRightClose size={17}/>:<PanelRight size={17}/>}</button>}
      {onClose&&<button type="button" aria-label={`关闭${typeof title==='string'?title:'浮层'}`} disabled={!closable} onClick={onClose}><X size={17}/></button>}</div>
    </header>}
    <div className="studio-floating-body">{children}</div>{footer&&<footer className="studio-floating-footer">{footer}</footer>}
  </section>,root);
}
