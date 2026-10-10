import { describe,expect,it } from "vitest";
import { createStudioBatch,studioBatchRequest,studioBatchSnapshot } from "./studio-batch";
import { makeStudioNode } from "./studio-nodes";
import type { IpModels } from "./api";
const models:IpModels={image:[{endpointId:"image",name:"image",isDefault:true,creditCost:8,billingUnit:"per_call"}],video:[{endpointId:"video",name:"video",isDefault:true,creditCost:30,billingUnit:"per_call"}]};
const cap={mock:false,operations:[],imageCost:8,textCost:2,videoCost:null};
const shot=()=>{const n=makeStudioNode("image");n.title="第二集镜头";n.metadata!.prompt="小紫挥手";n.metadata!.studio!.episodeNo=2;n.metadata!.studio!.references=[{storageKey:"main.jpg",role:"character"}];return n;};
describe("approved Studio batches",()=>{
  it("quotes only selected shots and uses the native billing unit for the ceiling",()=>{
    const plan=createStudioBatch([shot()],"work",models,cap,"9:16",5,2);
    expect(plan.steps.map(s=>s.operation)).toEqual(["image","video","assemble"]);expect(plan.approvedCost).toBe(38);expect(plan.episodeNo).toBe(2);
    expect(createStudioBatch([shot()],"clips",{...models,video:[{...models.video[0],billingUnit:"per_second"}]},cap,"9:16",5).approvedCost).toBe(158);
  });
  it("reuses an existing frame and rejects a changed authored source",()=>{
    const node=shot();node.metadata!.storageKey="frame.jpg";const plan=createStudioBatch([node],"clips",models,cap,"9:16",5);
    expect(plan.steps).toHaveLength(1);expect(studioBatchRequest(plan.steps[0],plan,[node]).references?.[0].storageKey).toBe("frame.jpg");
    node.metadata!.prompt="改过的动作";expect(()=>studioBatchRequest(plan.steps[0],plan,[node])).toThrow("来源内容已修改");
  });
  it("generated output does not invalidate the approval while a reference change does",()=>{
    const node=shot(),snapshot=studioBatchSnapshot(node);node.metadata!.storageKey="new-frame.jpg";expect(studioBatchSnapshot(node)).toBe(snapshot);
    node.metadata!.studio!.references=[{storageKey:"other-main.jpg",role:"character"}];expect(studioBatchSnapshot(node)).not.toBe(snapshot);
  });
  it("stops before submitting a video without its actual frame",()=>{
    const node=shot(),plan=createStudioBatch([node],"clips",models,cap,"9:16",5);
    expect(()=>studioBatchRequest(plan.steps[1],plan,[node])).toThrow("首帧尚未完成");
    expect(()=>createStudioBatch(Array.from({length:13},shot),"work",models,cap,"9:16",5)).toThrow("1 到 12");
  });
});

it('uses the chosen video model and freezes an existing adopted frame in the approval',()=>{
  const n=shot();n.metadata!.storageKey='approved.jpg';
  const plan=createStudioBatch([n],'clips',{...models,video:[...models.video,{endpointId:'chosen',name:'chosen',isDefault:false,creditCost:7,billingUnit:'per_second'}]},cap,'16:9',5,2,{videoModel:'chosen'});
  expect(plan.videoModel).toBe('chosen');expect(plan.approvedCost).toBe(35);
  expect(studioBatchRequest(plan.steps[0],plan,[n])).toMatchObject({model:'chosen',aspectRatio:'16:9',maxCost:35,references:[{storageKey:'approved.jpg'}]});
  n.metadata!.storageKey='different.jpg';expect(()=>studioBatchRequest(plan.steps[0],plan,[n])).toThrow('首帧已更换');
  expect(()=>createStudioBatch([n],'clips',models,cap,'9:16',5,2,{videoModel:'removed'})).toThrow('模型尚未配置');
});
