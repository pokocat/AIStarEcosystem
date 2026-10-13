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

test('prompt adoption updates editable drafts and shot description without changing the accepted request',async()=>{
  const {assistantReplacementNode,assistantFieldValue}=await import('./studio-assistant-plan');
  const node={...output,metadata:{prompt:'旧提示词',storageKey:'own',studio:{kind:'shot',request:{prompt:'已受理'},composerDraft:{prompt:'本次草稿'},shot:{description:'旧镜头'}}}} as CanvasNodeData;
  expect(assistantFieldValue(node,'prompt')).toBe('本次草稿');
  const updated=assistantReplacementNode(node,'prompt','新提示词');
  expect(updated.metadata).toMatchObject({prompt:'新提示词',storageKey:'own',studio:{request:{prompt:'已受理'},composerDraft:{prompt:'新提示词'},shot:{description:'新提示词'}}});
});
test('structured script adoption validates Markdown and preserves its canonical and structured versions',async()=>{
  const {assistantReplacementNode}=await import('./studio-assistant-plan');
  const {scriptFramework,markdownToScript}=await import('./studio-script-markdown');
  const markdown=scriptFramework('修改稿');const node={...output,type:CanvasNodeType.Text,metadata:{studio:{kind:'script',script:markdownToScript(scriptFramework('原稿'))}}} as CanvasNodeData;
  expect(()=>assistantReplacementNode(node,'script','只改一句话')).toThrow('保留一级标题');
  const updated=assistantReplacementNode(node,'script',markdown);
  expect(updated.metadata?.studio).toMatchObject({scriptMarkdown:markdown,script:{title:'修改稿'},scriptEditor:{draft:markdown,turns:[]}});
});
