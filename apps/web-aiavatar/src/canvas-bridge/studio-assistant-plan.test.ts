import { expect, test } from 'vitest';
import type { StudioPlan } from '@ai-star-eco/types/ip-studio-workflow';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { assistantStepReferences, assistantUnresolvedReferences, assistantWritableText } from './studio-assistant-plan';
const plan:StudioPlan={summary:'计划',questions:[],steps:[
  {id:'image',operation:'image',title:'设定图',prompt:'画图',referenceNodeIds:[],resultNodeId:'output'},
  {id:'video',operation:'video',title:'视频',prompt:'做视频',referenceNodeIds:[],dependsOn:['image']},
]};
const output:CanvasNodeData={id:'output',type:CanvasNodeType.Image,title:'设定图',width:320,height:400,position:{x:0,y:0},metadata:{status:'idle'}};
test('dependent media requires a real ready asset and blocks deleted, failed and running sources',()=>{
  for(const nodes of [[],[output],[{...output,metadata:{status:'loading' as const,storageKey:'old'}}],[{...output,metadata:{status:'error' as const,storageKey:'old'}}]]) {
    expect(assistantStepReferences(plan.steps[1],plan,nodes)).toEqual({ids:[],waiting:['设定图']});
  }
  expect(assistantStepReferences(plan.steps[1],plan,[{...output,metadata:{status:'success',storageKey:'actual'}}])).toEqual({ids:['output'],waiting:[]});
});
test('ordinary text can be selected for replacement but script, conversation and running nodes cannot',()=>{
  const text={...output,type:CanvasNodeType.Text};expect(assistantWritableText(text)).toBe(true);
  expect(assistantWritableText({...text,metadata:{status:'loading'}})).toBe(false);
  expect(assistantWritableText({...text,metadata:{studio:{kind:'assistant',conversation:{mode:'general',turns:[]}}}})).toBe(false);
  expect(assistantWritableText({...text,metadata:{studio:{kind:'script'}}})).toBe(false);
});

test('explicit earlier dependencies do not ask for another reference, while unknown names remain unresolved',()=>{
  const step={...plan.steps[1],unresolvedReferences:['image','missing']};
  expect(assistantUnresolvedReferences(step,plan)).toEqual(['missing']);
  expect(assistantUnresolvedReferences({...plan.steps[0],dependsOn:['video'],unresolvedReferences:['video']},plan)).toEqual(['video']);
});
