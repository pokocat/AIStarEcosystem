import { expect, test } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { replaceStudioVideo, validateStudioVideoUpload } from './studio-video-upload';
const source:CanvasNodeData={id:'source',type:CanvasNodeType.Video,title:'参考视频',position:{x:10,y:20},width:360,height:270,metadata:{runId:'old',videoTaskId:'old-job',storageKey:'old.mp4',studio:{kind:'shot',runId:'old',task:{status:'done',pct:100}}}};
const media={mediaType:'video' as const,key:'own/video.mp4',url:'/signed.mp4',fileName:'my.mp4',mimeType:'video/mp4',bytes:123,width:720,height:1280,durationSec:15};
test('upload fills the same connected video and removes stale run identity',()=>{
 const report={...source,id:'report',type:CanvasNodeType.Text,metadata:{studio:{kind:'recreation' as const}}};
 const next=replaceStudioVideo([source,report],[{id:'edge',fromNodeId:'source',toNodeId:'report'}],'source',media);
 expect(next[0]).toMatchObject({id:source.id,title:source.title,position:source.position,width:360,height:270,metadata:{storageKey:media.key,content:media.url,status:'success',durationMs:15000,naturalWidth:720,naturalHeight:1280}});
 expect(next[0].metadata?.studio?.runId).toBeUndefined();expect(next[0].metadata?.runId).toBeUndefined();expect(next[0].metadata?.videoTaskId).toBeUndefined();expect(next[0].metadata?.studio?.task).toBeUndefined();
 expect(next[0].metadata?.primaryVideoId).toBe(next[0].metadata?.videos?.[0].id);
 expect(next[1].metadata?.studio?.upstreamChanged).toBe(true);
 expect(source.metadata?.storageKey).toBe('old.mp4');
});
test('upload does not resurrect a deleted slot or replace a pending task',()=>{
 expect(()=>replaceStudioVideo([],[],'source',media)).toThrow();
 expect(()=>replaceStudioVideo([{...source,metadata:{status:'loading',studio:{kind:'shot',runId:'accepted',task:{status:'running',pct:1}}}}],[],'source',media)).toThrow();
 expect(()=>replaceStudioVideo([source],[],'source',{...media,key:''})).toThrow();
});
test('accepts MP4 without demanding a browser codec and rejects empty or oversized input',()=>{
 expect(()=>validateStudioVideoUpload({name:'手机.MP4',size:128*1024*1024})).not.toThrow();
 for(const file of [{name:'a.txt',size:12},{name:'a.mp4',size:0},{name:'a.mp4',size:128*1024*1024+1}])expect(()=>validateStudioVideoUpload(file)).toThrow();
});
