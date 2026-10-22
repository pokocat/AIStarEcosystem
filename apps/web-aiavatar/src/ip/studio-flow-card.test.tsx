// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { StudioFlowCard } from './studio-flow-canvas';
import { StudioMediaGenerationState } from './studio-media-generation-state';

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
  if(type===CanvasNodeType.Video)expect(screen.getByRole('progressbar',{name:`${label}任务进度`}).getAttribute('aria-valuenow')).toBe('11');
  else expect(screen.queryByRole('progressbar')).toBeNull();
  expect(view.container.querySelector('header small')).toBeNull();
  expect(screen.queryByText('任务进行中，可继续编辑画布')).toBeNull();
  if(type===CanvasNodeType.Video)expect(view.container.querySelector('video')?.getAttribute('src')).toBe('/old');
  view.rerender(<StudioFlowCard {...props} data={{document:{...node,metadata:{...node.metadata,status:'success',content:'/new',storageKey:'new',studio:{...node.metadata!.studio!,task:{status:'done',pct:100}}}}}}/>);
  expect(screen.queryByRole('status')).toBeNull();expect(screen.queryByRole('progressbar')).toBeNull();
  expect(view.container.querySelector(type===CanvasNodeType.Video?'video':'img')?.getAttribute('src')).toBe('/new');
});

test('an unknown image submission explains review without a spinner or misleading percentage, including after reload',()=>{
  const task={status:'running' as const,stage:'image.provider.recovering',pct:10,errorCode:'STUDIO_IMAGE_SUBMISSION_UNKNOWN'};
  const node:CanvasNodeData={id:'unknown',type:CanvasNodeType.Image,title:'医生低头写字',position:{x:0,y:0},width:320,height:400,
    metadata:{status:'loading',studio:{kind:'shot',runId:'IPR-unknown',task}}};
  const props={data:{document:node},selected:true} as any;
  const view=render(<StudioFlowCard {...props}/>);
  expect(screen.getByRole('status').textContent).toContain('受理结果待核对');
  expect(screen.getByRole('status').textContent).toContain('请联系运营核对原任务');
  expect(screen.getByRole('status').textContent).toContain('冻结积分待核实后结算');
  expect(screen.getByRole('status').textContent).not.toContain('10%');
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(view.container.querySelector('.studio-flow-generation-ring')).toBeNull();
  view.unmount();render(<StudioFlowCard {...props}/>);
  expect(screen.getByRole('status').textContent).toContain('受理结果待核对');
});

test.each(['image.generate.1','image.provider.processing','image.provider.recovering','storage.persist'])('image checkpoint %s is a stage, not a percentage',stage=>{
  render(<StudioMediaGenerationState media="image" confirmed task={{status:'running',stage,pct:10}}/>);
  expect(screen.getByRole('status').textContent).not.toContain('%');
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('an empty video offers upload without starting generation and hides mutation in read-only previews',()=>{
  const node:CanvasNodeData={id:'source',type:CanvasNodeType.Video,title:'参考视频',position:{x:0,y:0},width:360,height:270,metadata:{status:'idle'}};
  const commands:unknown[]=[]; const listener=(e:Event)=>commands.push((e as CustomEvent).detail);
  window.addEventListener('studio-command',listener);
  const view=render(<StudioFlowCard {...({data:{document:node},selected:true} as any)}/>);
  fireEvent.click(screen.getByRole('button',{name:'上传视频'}));
  expect(commands).toEqual([{action:'upload-video',nodeId:'source'}]);
  expect(screen.getByRole('button',{name:'生成视频'})).toBeDefined();
  view.rerender(<StudioFlowCard {...({data:{document:node,uploading:true},selected:true} as any)}/>);
  expect(screen.getByRole('button',{name:'上传处理中…'})).toHaveProperty('disabled',true);
  view.rerender(<StudioFlowCard {...({data:{document:node,readOnly:true},selected:false} as any)}/>);
  expect(screen.queryByRole('button',{name:'上传视频'})).toBeNull();
  window.removeEventListener('studio-command',listener);
});
test('a completed video can be replaced in place',()=>{
  const node:CanvasNodeData={id:'source',type:CanvasNodeType.Video,title:'参考视频',position:{x:0,y:0},width:360,height:270,metadata:{status:'success',content:'/clip.mp4',storageKey:'own/clip.mp4'}};
  render(<StudioFlowCard {...({data:{document:node},selected:true} as any)}/>);
  expect(screen.getByRole('button',{name:'替换视频'})).toBeDefined();
});
// Codex retest 2026-10-19 (R1): a video the assistant finished while the canvas was closed is restored with its key only;
// it showed as an empty 「上传视频」 card until a reload.
test('a finished video restored with only its key shows the video, not an upload placeholder',()=>{
  const node:CanvasNodeData={id:'take',type:CanvasNodeType.Video,title:'片段 1',position:{x:0,y:0},width:320,height:240,
    metadata:{status:'success',storageKey:'ipstudio_gen/u1/take.mp4',studio:{kind:'shot',runId:'r1',execution:{executionId:'PEX-1',stepId:'v1',runId:'r1'}}}};
  const view=render(<StudioFlowCard {...({data:{document:node},selected:false} as any)}/>);
  expect(view.container.querySelector('video')).not.toBeNull();
  expect(screen.queryByRole('button',{name:'上传视频'})).toBeNull();
});

// v0.221「不编造进度」：排队与未确认受理时不显示百分比（原 studio-media-generation-state.test.tsx）。
test('queue and unconfirmed submission do not show misleading percentages', () => {
  const queued = render(<StudioMediaGenerationState media="video" confirmed task={{ status: 'running', stage: 'queued', pct: 10, queue: { position: 3, running: 1 } }}/>);
  expect(screen.getByRole('status').textContent).toContain('等待生成视频');
  expect(screen.getByRole('status').textContent).toContain('第 3 位');
  expect(screen.queryByRole('progressbar')).toBeNull();
  queued.unmount();

  render(<StudioMediaGenerationState media="video" confirmed={false}/>);
  expect(screen.getByRole('status').textContent).toContain('正在确认生成任务');
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test.each(['VIDEO_SUBMISSION_UNKNOWN','VIDEO_RECONCILIATION_PENDING'])('video %s is explicit after refresh and has no 5 percent progress',errorCode=>{
  const task={status:'running',pct:5,errorCode};
  const view=render(<StudioMediaGenerationState media="video" task={task} confirmed/>);
  expect(screen.getByRole('status').textContent).toContain(errorCode==='VIDEO_SUBMISSION_UNKNOWN'?'受理结果待核对':'正在恢复原任务');
  expect(screen.queryByRole('progressbar')).toBeNull();expect(screen.getByRole('status').textContent).not.toContain('5%');
  expect(screen.getByRole('status').textContent).toContain('请勿重复生成');
  if(errorCode==='VIDEO_SUBMISSION_UNKNOWN')expect(view.container.querySelector('.studio-flow-generation-ring')).toBeNull();
});
