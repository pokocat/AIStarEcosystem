// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { StudioFlowCard } from './studio-flow-canvas';

vi.mock('@xyflow/react',()=>({useViewport:()=>({zoom:1}),Handle:()=>null,NodeResizer:()=>null,Position:{Right:'right',Left:'left'}}));
vi.mock('./studio-workspace',()=>({StudioWorkspace:()=>null}));
vi.mock('./studio-node-title',()=>({StudioNodeTitle:({title}:any)=><span>{title}</span>}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:()=>null}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:()=>null}));
afterEach(cleanup);

// Production screenshots 2026-10-20: both failed drafts still showed the empty-state upload / generate pair.
test.each([
  [CanvasNodeType.Video,'VIDEO_MODEL_RETIRED','这个视频模型已被提供方下架，不能再用它生成，请换一个模型','这个模型已不可用，请换一个模型再生成','上传视频，开始解析或拉片','video'],
  [CanvasNodeType.Image,'DAP_MODEL_HTTP_503','模型服务暂时不可用（上游 503），请稍后重试','模型服务暂时不可用（上游 503），请稍后重试','上传图片或使用 AI 创作','image'],
])('a failed %s draft says it failed and why, and offers one way back',(type,code,message,reason,emptyText,command)=>{
  const node:CanvasNodeData={id:'n',type,title:'短剧角色三视图·正面',position:{x:0,y:0},width:360,height:400,
    metadata:{status:'error',prompt:'正面全身',studio:{kind:'shot',runId:'IPR-1',request:{operation:command,prompt:'正面全身',model:'m'} as never,task:{status:'failed',stage:'failed',pct:100,errorCode:code,errorMessage:message}}}};
  const commands:unknown[]=[];const listener=(e:Event)=>commands.push((e as CustomEvent).detail);
  window.addEventListener('studio-command',listener);
  render(<StudioFlowCard {...({data:{document:node},selected:true} as any)}/>);
  expect(screen.getByRole('group',{name:'生成失败'}).textContent).toContain('没有生成出来');
  expect(screen.getByText(reason)).toBeDefined();
  expect(screen.queryByText(emptyText)).toBeNull();
  expect(screen.queryByRole('button',{name:type===CanvasNodeType.Video?'生成视频':'生成图片'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'修改后重试'}));
  expect(commands).toEqual([{action:command,nodeId:'n'}]);
  expect(screen.getByRole('button',{name:'查看错误详情'})).toBeDefined();
  window.removeEventListener('studio-command',listener);
});

test('a stopped draft and an empty draft keep their own states',()=>{
  const stopped:CanvasNodeData={id:'s',type:CanvasNodeType.Video,title:'片段',position:{x:0,y:0},width:360,height:240,metadata:{status:'error',studio:{kind:'shot',task:{status:'failed',stage:'cancelled',pct:0,errorCode:'IP_RUN_CANCELLED'}}}};
  const view=render(<StudioFlowCard {...({data:{document:stopped},selected:false} as any)}/>);
  expect(screen.queryByRole('group',{name:'生成失败'})).toBeNull();
  expect(screen.getByText('已停止')).toBeDefined();
  view.rerender(<StudioFlowCard {...({data:{document:{...stopped,metadata:{status:'idle'}}},selected:false} as any)}/>);
  expect(screen.getByText('上传视频，开始解析或拉片')).toBeDefined();
});
