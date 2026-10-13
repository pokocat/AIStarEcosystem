// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { StudioFlowCard } from './studio-flow-canvas';

vi.mock('@xyflow/react',()=>({useViewport:()=>({zoom:1}),Handle:()=>null,NodeResizer:()=>null,Position:{Right:'right',Left:'left'}}));
vi.mock('./studio-workspace',()=>({StudioWorkspace:()=>null}));
vi.mock('./studio-node-title',()=>({StudioNodeTitle:({title}:any)=><span>{title}</span>}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:({storageKey,...props}:any)=><img {...props} src={props.src}/>}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:({storageKey,...props}:any)=><video {...props}/>}));
afterEach(cleanup);

test.each([CanvasNodeType.Image,CanvasNodeType.Video])('%s generation is centered and disappears when its result completes',type=>{
  const node:CanvasNodeData={id:'n',type,title:'场景动作',position:{x:0,y:0},width:320,height:400,
    metadata:{status:'loading',content:'/old',storageKey:'old',studio:{kind:'shot',runId:'accepted',task:{status:'running',pct:11}}}};
  const props={data:{document:node},selected:true} as any;
  const view=render(<StudioFlowCard {...props}/>);
  const label=type===CanvasNodeType.Video?'视频':'图片';
  expect(screen.getByRole('status').textContent).toContain(`正在生成${label}`);
  expect(screen.getByRole('progressbar',{name:`${label}任务进度`}).getAttribute('aria-valuenow')).toBe('11');
  expect(view.container.querySelector('header small')).toBeNull();
  expect(screen.queryByText('任务进行中，可继续编辑画布')).toBeNull();
  if(type===CanvasNodeType.Video)expect(view.container.querySelector('video')?.getAttribute('src')).toBe('/old');
  view.rerender(<StudioFlowCard {...props} data={{document:{...node,metadata:{...node.metadata,status:'success',content:'/new',storageKey:'new',studio:{...node.metadata!.studio!,task:{status:'done',pct:100}}}}}}/>);
  expect(screen.queryByRole('status')).toBeNull();expect(screen.queryByRole('progressbar')).toBeNull();
  expect(view.container.querySelector(type===CanvasNodeType.Video?'video':'img')?.getAttribute('src')).toBe('/new');
});
