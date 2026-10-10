import {describe,it,expect} from "vitest";
import {parseStudioCaptions,studioWorkDraft,updateStudioWorkDraft} from "./studio-packaging";
import type {CanvasNodeData} from '@/canvas/types/canvas';
describe("explicit timed captions",()=>{
  it("retains user timings and literal text without interpreting filter syntax",()=>{
    expect(parseStudioCaptions("0-1.5：新创意\n1.5-3: 'text';[v]" )).toEqual([{start:0,end:1.5,text:"新创意"},{start:1.5,end:3,text:"'text';[v]"}]);
  });
  it("rejects overlapping, reverse and excessive timings",()=>{
    for(const text of ["0-3: 一\n2-4: 二","2-1: 逆序","0-601: 太长","没有时间: 字幕",Array.from({length:25},(_,i)=>`${i}-${i+1}: 字幕`).join("\n")])expect(()=>parseStudioCaptions(text)).toThrow();
  });
});

it('keeps independent per-episode work drafts and never changes an accepted assembly request',()=>{
  const request={clientRequestId:'accepted',nodeId:'work',operation:'assemble' as const,prompt:'assemble',aspectRatio:'16:9',packaging:{title:'已完成标题',captions:[{start:0,end:5,text:'原字幕'}],voiceoverStorageKey:'voice.wav'}};
  const work={id:'work',type:'video',title:'作品',position:{x:100,y:100},width:320,height:300,metadata:{studio:{kind:'work',episodeNo:1,request}}} as CanvasNodeData;
  expect(studioWorkDraft([work],1)).toMatchObject({title:'已完成标题',captionText:'0-5: 原字幕',voiceoverStorageKey:'voice.wav',aspectRatio:'16:9'});
  let nodes=updateStudioWorkDraft([work],{title:'未提交的新标题',captionText:'暂时无效的字幕'},'draft-1',1);
  nodes=updateStudioWorkDraft(nodes,{title:'第二集'},'draft-2',2);
  nodes=updateStudioWorkDraft(nodes,{brand:'品牌'},'unused',1);
  const restored=JSON.parse(JSON.stringify(nodes));
  expect(studioWorkDraft(restored,1)).toMatchObject({title:'未提交的新标题',captionText:'暂时无效的字幕',brand:'品牌',voiceoverStorageKey:'voice.wav'});
  expect(studioWorkDraft(restored,2).title).toBe('第二集');expect(studioWorkDraft(restored).title).toBe('');
  expect(restored).toHaveLength(3);expect(restored[0].metadata.studio.request).toEqual(request);
  expect(restored[1].position.x).toBeGreaterThan(work.position.x+work.width);
});
