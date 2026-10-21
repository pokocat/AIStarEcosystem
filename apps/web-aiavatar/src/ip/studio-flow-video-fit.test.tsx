// @vitest-environment jsdom
// 视频节点铺满（2026-10-21）：the card draws a fitted clip edge to edge, keeps the clip's shape while resized and shows a
// local 抽帧 placeholder as 「处理中」.
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { StudioFlowCard } from './studio-flow-canvas';

const resizers: any[] = [];
vi.mock('@xyflow/react',()=>({useViewport:()=>({zoom:1}),Handle:()=>null,NodeResizer:(props:any)=>{resizers.push(props);return null;},Position:{Right:'right',Left:'left'}}));
vi.mock('./studio-workspace',()=>({StudioWorkspace:()=>null}));
vi.mock('./studio-node-title',()=>({StudioNodeTitle:({title}:any)=><span>{title}</span>}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:({storageKey,...props}:any)=><video {...props}/>}));
afterEach(()=>{cleanup();resizers.length=0;});

const video=(over:Partial<CanvasNodeData>={},meta:CanvasNodeData['metadata']={}):CanvasNodeData=>({id:'v',type:CanvasNodeType.Video,title:'镜头',position:{x:0,y:0},width:320,height:Math.round(320*9/16+38),
  metadata:{status:'success',content:'/v.mp4',storageKey:'k/v.mp4',naturalWidth:1920,naturalHeight:1080,...meta},...over});

test('a video in its clip shape is drawn edge to edge and resizes keeping the ratio, exact at the end',()=>{
  const onVideoResized=vi.fn();
  const view=render(<StudioFlowCard {...({data:{document:video(),onVideoResized},selected:true} as any)}/>);
  expect(view.container.querySelector('article')!.classList.contains('is-fitted')).toBe(true);
  const resizer=resizers.at(-1);
  expect(resizer.keepAspectRatio).toBe(true);
  resizer.onResizeEnd();
  expect(onVideoResized).toHaveBeenCalledWith('v');
});

test('a box out of shape is not cropped; a video of unknown size resizes freely',()=>{
  const view=render(<StudioFlowCard {...({data:{document:video({height:300})},selected:true} as any)}/>);
  expect(view.container.querySelector('article')!.classList.contains('is-fitted')).toBe(false);
  view.rerender(<StudioFlowCard {...({data:{document:video({},{naturalWidth:undefined,naturalHeight:undefined})},selected:true} as any)}/>);
  expect(view.container.querySelector('article')!.classList.contains('is-fitted')).toBe(false);
  expect(resizers.at(-1).keepAspectRatio).toBe(false);
  expect(resizers.at(-1).onResizeEnd).toBeUndefined();
});

test('an image node keeps its old behavior',()=>{
  const image:CanvasNodeData={id:'i',type:CanvasNodeType.Image,title:'图',position:{x:0,y:0},width:320,height:218,metadata:{status:'success',content:'/i.png',storageKey:'k/i.png',naturalWidth:1920,naturalHeight:1080}};
  const view=render(<StudioFlowCard {...({data:{document:image},selected:true} as any)}/>);
  expect(view.container.querySelector('article')!.classList.contains('is-fitted')).toBe(false);
  expect(resizers.at(-1).keepAspectRatio).toBe(false);
});

test('a 抽帧 placeholder shows 处理中 and offers nothing to edit',()=>{
  const node:CanvasNodeData={id:'p',type:CanvasNodeType.Image,title:'镜头 · 首帧',position:{x:0,y:0},width:320,height:218,metadata:{}};
  const view=render(<StudioFlowCard {...({data:{document:node,readOnly:true,processing:true},selected:false} as any)}/>);
  expect(view.getByRole('status').textContent).toBe('处理中');
  expect(view.container.querySelector('article')!.getAttribute('aria-busy')).toBe('true');
  expect(view.queryAllByRole('button')).toHaveLength(0);
  expect(resizers).toHaveLength(0);
});
