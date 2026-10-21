import { describe,it,expect } from "vitest";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import {studioVideoSettings,studioVideoQuote,studioVideoError,studioVideoModeName,changeStudioVideoDraft,studioVideoReferenceIds,studioVideoDraftFromReferences,studioVideoNodeSelection,type StudioVideoDraft} from "./studio-video";
import {CanvasNodeType,type CanvasNodeData} from "@/canvas/types/canvas";
const model={contract:{modes:[{mode:"t2v"},{mode:"i2v",needsFirstFrame:true},{mode:"first_last_frame_video",needsFirstFrame:true,needsLastFrame:true},
  {mode:"universal_reference_video",references:{image:{maxCount:9},video:{maxCount:1},audio:{maxCount:3},maxTotal:12,maxImagesWithVideo:8,minVisual:1,maxAudioTotalSec:15}}],
  tiers:[{tier:"768p",canvases:[{aspectRatio:"9:16"}]}],minSeconds:5,maxSeconds:15,promptMaxChars:7000,seedMax:2147483647},
  pricing:{perSecond:{first_last_frame_video:{"768p":40},universal_reference_video:{"768p":45},i2v:{"768p":40}},freeRefImages:1,extraRefImagePerSecond:2}} as VideoStudioModel;
describe("video modes preserve every chosen reference",()=>{
  it("uses a configured custom mode for frames, references, label, optional prompt and price",()=>{
    const customMode={mode:"product-shot",label:"商品镜头",promptRequired:false,needsFirstFrame:true,needsLastFrame:true,
      references:{image:{maxCount:2},video:{maxCount:1},audio:{maxCount:0},maxTotal:3,maxImagesWithVideo:2,minVisual:1,maxAudioTotalSec:0}} as VideoStudioModel["contract"]["modes"][number];
    const customModel={...model,contract:{...model.contract,modes:[customMode]},pricing:{...model.pricing,
      perSecond:{"product-shot":{"768p":10}},freeRefImages:0,extraRefImagePerSecond:2}} as VideoStudioModel;
    const draft={mode:"product-shot",tier:"768p",firstId:"first",lastId:"last"};
    expect(studioVideoModeName(customMode)).toBe("商品镜头");
    expect(studioVideoReferenceIds(draft,["first","last","image","video"],customMode)).toEqual(["first","last","image","video"]);
    const video=studioVideoSettings(customMode.mode,"768p",[
      {mediaType:"image",storageKey:"first"},{mediaType:"image",storageKey:"last"},
      {mediaType:"image",storageKey:"image"},{mediaType:"video",storageKey:"video"}],undefined,customMode);
    expect(video).toMatchObject({firstFrameKey:"first",lastFrameKey:"last",references:[
      {mediaType:"image",key:"image"},{mediaType:"video",key:"video"}]});
    expect(studioVideoQuote(customModel,video,5)).toBe(60);
    expect(studioVideoError(customModel,video,"","9:16",5)).toBeUndefined();
  });
  it("sends ordered first and last keys and the chosen seed",()=>{
    const v=studioVideoSettings("first_last_frame_video","768p",[{mediaType:"image",storageKey:"first"},{mediaType:"image",storageKey:"last"}],42);
    expect(v.firstFrameKey).toBe("first");expect(v.lastFrameKey).toBe("last");expect(v.seed).toBe(42);
    expect(studioVideoQuote(model,v,7)).toBe(280);expect(studioVideoError(model,v,"过渡","9:16",7)).toBeUndefined();
  });
  it("preserves mixed references in order and includes image surcharge",()=>{
    const v=studioVideoSettings("universal_reference_video","768p",[{mediaType:"audio",storageKey:"a"},{mediaType:"image",storageKey:"i"},{mediaType:"image",storageKey:"i2"},{mediaType:"video",storageKey:"v"}]);
    expect(v.references?.map(r=>r.key)).toEqual(["a","i","i2","v"]);expect(studioVideoQuote(model,v,8)).toBe(376);
  });
  it("rejects incomplete uploads and extra references instead of dropping them",()=>{
    expect(()=>studioVideoSettings("i2v","768p",[{mediaType:"image"}])).toThrow(/上传/);
    expect(()=>studioVideoSettings("i2v","768p",[{mediaType:"image",storageKey:"1"},{mediaType:"image",storageKey:"2"}])).toThrow(/一张/);
    expect(()=>studioVideoSettings("t2v","768p",[{mediaType:"image",storageKey:"1"}])).toThrow(/移除/);
  });
  it("unpriced, duplicate, audio only and out of contract input cannot submit",()=>{
    const v=studioVideoSettings("universal_reference_video","768p",[{mediaType:"audio",storageKey:"a"}]);
    expect(studioVideoError(model,v,"x","9:16",8)).toMatch(/图片或/);
    v.references=[{mediaType:"image",key:"x"},{mediaType:"image",key:"x"}];expect(studioVideoError(model,v,"x","9:16",8)).toMatch(/一次/);
    expect(studioVideoError(model,v,"x","16:9",8)).toMatch(/画幅/);
    expect(studioVideoQuote(model,{mode:"t2v",resolutionTier:"768p"},5)).toBeNull();
    expect(studioVideoError(model,{mode:"i2v",resolutionTier:"768p",firstFrameKey:"f",seed:-1},"x","9:16",8)).toMatch(/种子/);
  });
});

describe("「按原文生成」asks the vendor not to rewrite the description",()=>{
  it("adds optimizePrompt=false only when chosen; the inputs and price are unchanged",()=>{
    const plain=studioVideoSettings("i2v","768p",[{mediaType:"image",storageKey:"first"}],7);
    const kept=studioVideoSettings("i2v","768p",[{mediaType:"image",storageKey:"first"}],7,undefined,true);
    expect(plain).not.toHaveProperty("optimizePrompt");
    expect(kept).toEqual({...plain,optimizePrompt:false});
    expect(studioVideoQuote(model,kept,8)).toBe(studioVideoQuote(model,plain,8));
  });
  it("a reopened node restores the choice from its accepted request, not from a template preset",()=>{
    const accepted={type:CanvasNodeType.Video,metadata:{videoMode:"t2v",studio:{request:{video:{mode:"t2v",resolutionTier:"768p",optimizePrompt:false}}}}} as CanvasNodeData;
    expect(studioVideoNodeSelection(accepted,[],[]).draft.keepPrompt).toBe(true);
    const preset={type:CanvasNodeType.Video,metadata:{studio:{videoPreset:{mode:"t2v",resolutionTier:"768p"}}}} as CanvasNodeData;
    expect(studioVideoNodeSelection(preset,[],[]).draft).not.toHaveProperty("keepPrompt");
  });
});
describe("reopening a native video node in Studio",()=>{
  const nodes=[{id:"first",type:CanvasNodeType.Image},{id:"last",type:CanvasNodeType.Image},{id:"audio",type:CanvasNodeType.Audio}] as CanvasNodeData[];
  it("inherits unsent frame selection, native geometry and quantity rather than the drawer defaults",()=>{
    const node={type:CanvasNodeType.Video,metadata:{videoCount:"4",seconds:"8",vquality:"544",size:"544x967",videoMode:"frames"}} as CanvasNodeData;
    const selection=studioVideoNodeSelection(node,nodes,["last","first"]);
    expect(selection).toEqual({count:4,seconds:8,ratio:"9:16",draft:{mode:"first_last_frame_video",tier:"544p",firstId:"last",lastId:"first",seed:undefined}});
  });
  // 同一个期望，三种来源：已受理的 request、作者模板的 videoPreset、只剩原生节点 metadata。
  it("reopens the exact custom mode, tier and canvas from the accepted request, an authored template, or bare metadata",()=>{
    const fromRequest={type:CanvasNodeType.Video,metadata:{videoMode:"product-shot",vquality:"portraitX",size:"600x900",
      studio:{request:{aspectRatio:"2:3",video:{mode:"product-shot",resolutionTier:"portraitX"}}}}} as CanvasNodeData;
    const fromTemplate={type:CanvasNodeType.Video,metadata:{videoMode:"product-shot",vquality:"portraitX",size:"2:3",
      studio:{videoPreset:{mode:"product-shot",resolutionTier:"portraitX"}}}} as CanvasNodeData;
    const metadataOnly={type:CanvasNodeType.Video,metadata:{videoMode:"product-shot",vquality:"portraitX",size:"2:3"}} as CanvasNodeData;
    for(const node of [fromRequest,fromTemplate,metadataOnly])
      expect(studioVideoNodeSelection(node,nodes,[])).toMatchObject({ratio:"2:3",draft:{mode:"product-shot",tier:"portraitX"}});
  });
  it("uses current control edits and keeps mixed references without resurrecting disconnected frames",()=>{
    const node={type:CanvasNodeType.Video,metadata:{videoCount:"2",seconds:"10",size:"16:9",videoMode:"reference",studio:{request:{count:4,durationSec:8,aspectRatio:"9:16",video:{mode:"first_last_frame_video",resolutionTier:"768p",firstFrameKey:"old",lastFrameKey:"old-tail",seed:42}}}}} as CanvasNodeData;
    const selection=studioVideoNodeSelection(node,nodes,["first","audio"]);
    expect(selection).toMatchObject({count:2,seconds:10,ratio:"16:9",draft:{mode:"universal_reference_video",firstId:"first",lastId:undefined,seed:42}});
    node.metadata!.videoMode="frames";
    expect(studioVideoNodeSelection(node,nodes,[]).draft).toMatchObject({mode:"t2v",firstId:undefined,lastId:undefined,seed:42});
  });
  it("treats a selected image as a first frame without reusing its image quantity or dimensions as video controls",()=>{
    const image={type:CanvasNodeType.Image,metadata:{size:"1024x1536",studio:{request:{count:4,model:"image-endpoint"}}}} as CanvasNodeData;
    expect(studioVideoNodeSelection(image,nodes,["first"])).toMatchObject({count:1,seconds:8,ratio:"9:16",draft:{mode:"i2v",tier:"768p",firstId:"first"}});
  });
  it("starts a storyboard video with the authored shot duration and its generated frame ratio",()=>{
    const image={type:CanvasNodeType.Image,metadata:{studio:{shot:{durationSec:5},request:{operation:"image",count:4,durationSec:8,aspectRatio:"16:9"}}}} as CanvasNodeData;
    expect(studioVideoNodeSelection(image,nodes,["first"])).toMatchObject({count:1,seconds:5,ratio:"16:9",draft:{mode:"i2v",firstId:"first"}});
  });
  it("does not carry an unsupported 3:4 image ratio into a legacy image-to-video request",()=>{
    const image={type:CanvasNodeType.Image,metadata:{studio:{request:{aspectRatio:"3:4"}}}} as CanvasNodeData;
    expect(studioVideoNodeSelection(image,nodes,["first"]).ratio).toBe("9:16");
    const legacyVideo={type:CanvasNodeType.Video,metadata:{studio:{request:{aspectRatio:"3:4"}}}} as CanvasNodeData;
    expect(studioVideoNodeSelection(legacyVideo,nodes,[]).ratio).toBe("9:16");
    const nativeVideo={type:CanvasNodeType.Video,metadata:{videoMode:"frames",studio:{request:{aspectRatio:"3:4"}}}} as CanvasNodeData;
    expect(studioVideoNodeSelection(nativeVideo,nodes,[]).ratio).toBe("3:4");
  });
});

describe("video selection across modes, the IP library and legacy models",()=>{
  const images=new Set(["A","B","C"]);
  const frames:StudioVideoDraft={mode:"first_last_frame_video",tier:"768p",seed:42,firstId:"A",lastId:"B"};
  const payload=(draft:StudioVideoDraft,ids:string[])=>studioVideoSettings(draft.mode,draft.tier,
    studioVideoReferenceIds(draft,ids).map(id=>({storageKey:id,mediaType:images.has(id)?"image":id==="video"?"video":"audio"})),draft.seed);
  it("carries A/B, exchanged B/A, and the library's exact replacement A/C into universal references",()=>{
    let selection=changeStudioVideoDraft(frames,{...frames,mode:"universal_reference_video"},[],images);
    expect(payload(selection.draft,selection.referenceIds).references?.map(r=>r.key)).toEqual(["A","B"]);
    selection=changeStudioVideoDraft(frames,{...frames,firstId:"B",lastId:"A"},["A","B"],images);
    selection=changeStudioVideoDraft(selection.draft,{...selection.draft,mode:"universal_reference_video"},selection.referenceIds,images);
    expect(payload(selection.draft,selection.referenceIds).references?.map(r=>r.key)).toEqual(["B","A"]);
    selection=changeStudioVideoDraft(frames,{...frames,lastId:"C"},["A","B"],images);
    selection=changeStudioVideoDraft(selection.draft,{...selection.draft,mode:"universal_reference_video"},selection.referenceIds,images);
    expect(payload(selection.draft,selection.referenceIds).references?.map(r=>r.key)).toEqual(["A","C"]);
    selection=changeStudioVideoDraft(selection.draft,{...selection.draft,mode:"first_last_frame_video"},selection.referenceIds,images);
    expect(payload(selection.draft,selection.referenceIds)).toMatchObject({firstFrameKey:"A",lastFrameKey:"C",seed:42,resolutionTier:"768p"});
  });
  it("keeps video and audio when temporarily using frames and replacing a frame",()=>{
    const draft={...frames,mode:"universal_reference_video" as const};
    let selection=changeStudioVideoDraft(draft,{...draft,mode:"first_last_frame_video"},["A","B","video","audio"],images);
    selection=changeStudioVideoDraft(selection.draft,{...selection.draft,firstId:"C"},selection.referenceIds,images);
    selection=changeStudioVideoDraft(selection.draft,{...selection.draft,mode:"universal_reference_video"},selection.referenceIds,images);
    expect(payload(selection.draft,selection.referenceIds).references).toEqual([
      {key:"C",mediaType:"image"},{key:"B",mediaType:"image"},{key:"video",mediaType:"video"},{key:"audio",mediaType:"audio"}]);
  });
  it("does not resurrect a deleted tail when returning from a legacy model",()=>{
    const legacyIds=studioVideoReferenceIds(frames,[]).filter(id=>id!=="B");
    const returned=studioVideoDraftFromReferences(frames,legacyIds,images);
    expect(returned).toMatchObject({firstId:"A",lastId:undefined,mode:"first_last_frame_video",seed:42});
    expect(studioVideoReferenceIds(returned,legacyIds)).toEqual(["A"]);
    expect(()=>payload(returned,legacyIds)).toThrow(/首帧图和一张尾帧图/);
    const replaced=studioVideoDraftFromReferences(frames,["C"],images);
    expect(replaced.firstId).toBe("C");expect(replaced.lastId).toBeUndefined();
  });
  it("keeps the remaining mixed reference order after a legacy edit",()=>{
    const draft={...frames,mode:"universal_reference_video" as const};
    const legacyIds=studioVideoReferenceIds(draft,["B","A","video","audio"]).filter(id=>id!=="audio");
    const returned=studioVideoDraftFromReferences(draft,legacyIds,images);
    expect(payload(returned,legacyIds).references?.map(r=>r.key)).toEqual(["B","A","video"]);
    const frameMode=changeStudioVideoDraft(returned,{...returned,mode:"first_last_frame_video"},legacyIds,images);
    expect(payload(frameMode.draft,frameMode.referenceIds)).toMatchObject({firstFrameKey:"B",lastFrameKey:"A"});
  });
  it("uses the legacy-selected first image and accepts a library image in a fresh draft",()=>{
    const fresh:StudioVideoDraft={mode:"t2v",tier:"768p"};
    expect(payload(studioVideoDraftFromReferences(fresh,["C"],images),["C"])).toMatchObject({mode:"i2v",firstFrameKey:"C"});
    const imported=changeStudioVideoDraft(fresh,{...fresh,mode:"i2v",firstId:"C"},[],images);
    expect(payload(imported.draft,imported.referenceIds)).toMatchObject({mode:"i2v",firstFrameKey:"C"});
  });
});
