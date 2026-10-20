import { describe,it,expect } from 'vitest';
import type { VideoStudioModel } from '@ai-star-eco/types/video-studio';
import { CanvasNodeType,type CanvasNodeData } from '@/canvas/types/canvas';
import { adaptStudioVideoReferences,studioVideoAcceptsReferences,studioVideoSelectionIds } from './studio-video-selection';
import { studioVideoSettings,studioVideoError } from './studio-video';
const model={contract:{modes:[{mode:'t2v'},{mode:'i2v',needsFirstFrame:true},{mode:'first_last_frame_video',needsFirstFrame:true,needsLastFrame:true},
 {mode:'universal_reference_video',references:{image:{maxCount:3},video:{maxCount:1},audio:{maxCount:1},maxTotal:4,maxImagesWithVideo:2,minVisual:1,maxAudioTotalSec:15}}],tiers:[{tier:'768p',canvases:[{aspectRatio:'9:16'}]}],minSeconds:5,maxSeconds:15,promptMaxChars:7000,seedMax:100},pricing:{perSecond:{universal_reference_video:{'768p':40}},freeRefImages:1,extraRefImagePerSecond:2}} as VideoStudioModel;
const nodes=[['one',CanvasNodeType.Image],['two',CanvasNodeType.Image],['three',CanvasNodeType.Image],['four',CanvasNodeType.Image],['video',CanvasNodeType.Video],['audio',CanvasNodeType.Audio]].map(([id,type])=>({id,type})) as CanvasNodeData[];
describe('video selection adapts losslessly to the endpoint contract',()=>{
 it('moves from text to first frame to first/last to references, and back as inputs are removed',()=>{
  let draft={mode:'t2v',tier:'768p',seed:0};
  for(const [ids,mode] of [[['one'],'i2v'],[['one','two'],'first_last_frame_video'],[['one','two','three'],'universal_reference_video'],[[],'t2v']] as [string[],string][]) {
   draft=adaptStudioVideoReferences(model,draft,ids,nodes);expect(draft.mode).toBe(mode);expect(draft.seed).toBe(0);expect(new Set(studioVideoSelectionIds(draft,ids))).toEqual(new Set(ids));
  }
 });
 it('switches to a mixed reference mode and still validates required visual inputs',()=>{
  const draft=adaptStudioVideoReferences(model,{mode:'i2v',tier:'768p',firstId:'one'},['one','video','audio'],nodes);
  expect(draft.mode).toBe('universal_reference_video');
  expect(studioVideoSelectionIds(draft,['one','video','audio'])).toEqual(['one','video','audio']);
  const video=studioVideoSettings(draft.mode,draft.tier,[{mediaType:'audio',storageKey:'a'}],undefined,model.contract.modes[3]);
  expect(studioVideoError(model,video,'动作','9:16',8)).toMatch(/图片或/);
 });
 it('keeps an explicit compatible mode and frame order but rejects modes that would hide inputs',()=>{
  const draft=adaptStudioVideoReferences(model,{mode:'first_last_frame_video',tier:'768p',firstId:'two',lastId:'one'},['one','two'],nodes,'universal_reference_video');
  expect(draft.mode).toBe('universal_reference_video');expect(studioVideoSelectionIds(draft,['one','two'])).toEqual(['two','one']);
  expect(studioVideoAcceptsReferences(model.contract.modes[0],['one'],nodes)).toBe(false);
  expect(studioVideoAcceptsReferences(model.contract.modes[1],['one','two'],nodes)).toBe(false);
  expect(studioVideoAcceptsReferences(model.contract.modes[3],['one','two','three','video'],nodes)).toBe(false);
 });
 it('uses custom modes by capabilities and never silently drops inputs on a restricted model',()=>{
  const custom={...model,contract:{...model.contract,modes:[{mode:'product',needsFirstFrame:true,needsLastFrame:true}]}} as VideoStudioModel;
  expect(adaptStudioVideoReferences(custom,{mode:'t2v',tier:'768p'},['one','two'],nodes).mode).toBe('product');
  const draft=adaptStudioVideoReferences(custom,{mode:'product',tier:'768p'},['one','two','audio'],nodes);
  expect(studioVideoSelectionIds(draft,['one','two','audio'])).toEqual(['one','two','audio']);
  expect(()=>studioVideoSettings(draft.mode,draft.tier,[{mediaType:'image',storageKey:'one'},{mediaType:'image',storageKey:'two'},{mediaType:'audio',storageKey:'a'}],undefined,custom.contract.modes[0])).toThrow(/移除/);
 });
});
