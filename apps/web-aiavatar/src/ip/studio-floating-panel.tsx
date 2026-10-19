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
  onClose?:()=>void;closable?:boolean;utility?:boolean;dockable?:boolean;above?:boolean;className?:string;container?:HTMLElement|null;embedded?:boolean;
  /** Chips next to the title (a mode, a demo mark); the title itself stays a plain string so the dialog keeps its name. */
  titleExtra?:ReactNode;
  /** A mark before the title (the assistant's AI sign). */
  titleIcon?:ReactNode;
  /** A strip between the header and the scrolling body: progress, status. Never scrolls away. */
  subheader?:ReactNode;
  /** Remember docked / floating and the docked width per viewer under this key (a per-browser convenience, not state). */
  layoutKey?:string;
  /** Where a panel opens the first time on this browser; a remembered choice wins. */
  defaultDocked?:boolean;
  /** Docked panels can be dragged wider or narrower at their left edge. */
  resizable?:boolean;minWidth?:number;maxWidth?:number};
type PanelLayout={docked?:boolean;width?:number};
function readLayout(key?:string):PanelLayout {
  if(!key)return {};
  try{const raw=localStorage.getItem(`studio-floating:${key}`);const parsed=raw?JSON.parse(raw) as PanelLayout:{};return typeof parsed==='object'&&parsed?parsed:{};}catch{return {};}
}
function writeLayout(key:string|undefined,patch:PanelLayout) {
  if(!key)return;
  try{localStorage.setItem(`studio-floating:${key}`,JSON.stringify({...readLayout(key),...patch}));}catch{/* private window or blocked storage: the layout just is not remembered */}
}
type FloatingEntry={id:symbol;root:HTMLElement;update:(layer:number,active:boolean)=>void};
// One bounded stack per canvas stage. Popups remain above it; closed entries are removed.
const floatingStack:FloatingEntry[]=[];
/** Where a docked panel's width is published: the canvas shell (its overlay is the stage's sibling), else the stage itself. */
const dockHost=(root:HTMLElement)=>root.closest<HTMLElement>('.studio-flow-shell')||root;
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
export function StudioFloatingPanel({open,title,anchorId,width=660,children,footer,onClose,closable=true,utility=false,dockable=false,above=false,className='',container,embedded=false,
  titleExtra,titleIcon,subheader,layoutKey,defaultDocked=false,resizable=false,minWidth=400,maxWidth=760}:Props) {
  const revision=useContext(StudioFloatingContext), ref=useRef<HTMLElement>(null);
  const identity=useRef(Symbol('floating-panel')),[layer,setLayer]=useState({z:90,active:false});
  const [root,setRoot]=useState<HTMLElement|null>(null),[position,setPosition]=useState({left:0,top:0});
  const [docked,setDocked]=useState(()=>dockable&&(readLayout(layoutKey).docked??defaultDocked));
  const [dockedWidth,setDockedWidth]=useState(()=>{const saved=readLayout(layoutKey).width;return saved&&saved>=minWidth&&saved<=maxWidth?saved:width;});
  const toggleDocked=()=>setDocked(v=>{writeLayout(layoutKey,{docked:!v});return !v;});
  const resize=useRef<{x:number;width:number}|undefined>(undefined);
  const [manual,setManual]=useState<{left:number;top:number}>(),drag=useRef<{x:number;y:number;left:number;top:number}|undefined>(undefined);
  useLayoutEffect(()=>{if(open&&!embedded)setRoot(container||document.querySelector<HTMLElement>('[data-studio-floating-root]')||document.querySelector<HTMLElement>('.ip-surface'));},[open,container,embedded]);
  useLayoutEffect(()=>{
    if(!open||embedded||!root||!ref.current)return;
    const place=()=>{
      if(!ref.current)return;const rect=root.getBoundingClientRect(),panel=ref.current.getBoundingClientRect();
      // Floating panels lay out inside the part of the stage a docked panel leaves free.
      const dock=docked?0:parseFloat(dockHost(root).style.getPropertyValue('--studio-docked-panel'))||0;
      const stage={left:rect.left,top:rect.top,width:rect.width-dock,height:rect.height};
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
  },[open,embedded,root,anchorId,revision,manual,docked,utility,above]);
  useEffect(()=>{setManual(undefined);},[anchorId]);
  // A docked panel owns a strip of the stage: the stage learns its width so right-anchored toolbars and other
  // floating panels keep clear of it (CSS reads --studio-docked-panel on the stage root).
  useLayoutEffect(()=>{
    if(!open||embedded||!root||!docked)return;
    const host=dockHost(root);
    host.classList.add('has-docked-panel');host.style.setProperty('--studio-docked-panel',`${dockedWidth}px`);
    return()=>{host.classList.remove('has-docked-panel');host.style.removeProperty('--studio-docked-panel');};
  },[open,embedded,root,docked,dockedWidth]);
  useLayoutEffect(()=>{
    if(!open||embedded||!root||!title)return;
    const entry:FloatingEntry={id:identity.current,root,update:(z,active)=>setLayer({z,active})};
    floatingStack.push(entry);refreshStack(root);
    return()=>{const index=floatingStack.indexOf(entry);if(index>=0)floatingStack.splice(index,1);refreshStack(root);};
  },[open,embedded,root,!!title]);
  useEffect(()=>{
    if(!open||embedded||!onClose||!closable)return;
    const escape=(e:KeyboardEvent)=>{
      if(e.key!=='Escape'||e.defaultPrevented||!title||floatingStack.filter(entry=>entry.root===root).at(-1)?.id!==identity.current)return;
      // Inner editors and Antd menus own their first Escape. Expanded modals protect focus.
      if(document.querySelector('.ant-modal-wrap:not([style*="display: none"]),.ant-select-dropdown:not(.ant-select-dropdown-hidden),.ant-popover:not(.ant-popover-hidden)'))return;
      e.preventDefault();onClose();
    };
    document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
  },[open,embedded,onClose,closable,root,!!title]);
  if(!open)return null;
  // Storyboard embeds the same creator in its detail pane; no canvas anchor or floating stack.
  if(embedded)return <section className={`studio-embedded-composer ${className}`} aria-label={typeof title==='string'?title:undefined}>
    <div className="studio-floating-body">{children}</div>{footer&&<footer className="studio-floating-footer">{footer}</footer>}
  </section>;
  if(!root)return null;
  return createPortal(<section ref={ref} className={`studio-floating-panel nodrag nopan nowheel${utility?' is-utility':''}${docked?' is-docked':''}${above?' is-context-toolbar':''} ${className}`}
    role={title?'dialog':undefined} aria-modal={title?false:undefined} aria-label={typeof title==='string'?title:undefined} data-anchor-id={anchorId} data-active={title?layer.active:undefined}
    onPointerDownCapture={()=>raiseFloating(identity.current)} onFocusCapture={()=>raiseFloating(identity.current)}
    style={{width:docked?dockedWidth:width,left:docked?undefined:position.left,top:docked?undefined:position.top,zIndex:title?layer.z:undefined}}>
    {docked&&resizable&&<div className="studio-floating-resize" role="separator" aria-orientation="vertical" aria-label="调整宽度" title="拖动调整宽度" onPointerDown={e=>{
      resize.current={x:e.clientX,width:dockedWidth};e.currentTarget.setPointerCapture?.(e.pointerId);
    }} onPointerMove={e=>{if(resize.current)setDockedWidth(Math.max(minWidth,Math.min(maxWidth,resize.current.width+resize.current.x-e.clientX)));}}
    onPointerUp={()=>{if(resize.current)writeLayout(layoutKey,{width:dockedWidth});resize.current=undefined;}}
    onPointerCancel={()=>{resize.current=undefined;}}/>}
    {title&&<header className={`studio-floating-header${utility?' is-draggable':''}`} onPointerDown={e=>{
      if(!utility||docked||(e.target as HTMLElement).closest('button'))return;
      drag.current={x:e.clientX,y:e.clientY,...position};e.currentTarget.setPointerCapture?.(e.pointerId);
    }} onPointerMove={e=>{if(drag.current)setManual({left:drag.current.left+e.clientX-drag.current.x,top:drag.current.top+e.clientY-drag.current.y});}}
    onPointerUp={()=>{drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}}>
      <div className="studio-floating-title">{titleIcon}<strong>{title}</strong>{titleExtra}</div><div>{dockable&&<button type="button" aria-label={docked?'改成浮窗':'停靠到右侧'} title={docked?'改成浮窗':'停靠到右侧'} onClick={toggleDocked}>{docked?<PanelRightClose size={17}/>:<PanelRight size={17}/>}</button>}
      {onClose&&<button type="button" aria-label={`关闭${typeof title==='string'?title:'浮层'}`} disabled={!closable} onClick={onClose}><X size={17}/></button>}</div>
    </header>}
    {subheader&&<div className="studio-floating-subheader">{subheader}</div>}
    <div className="studio-floating-body">{children}</div>{footer&&<footer className="studio-floating-footer">{footer}</footer>}
  </section>,root);
}
