import {expect,test} from 'vitest';
import {splitStudioConversations} from './studio-conversations';
import type {CanvasNodeData} from '@/canvas/types/canvas';
const text={id:'text',type:'text',title:'角色',position:{x:0,y:0},width:300,height:200,metadata:{content:'角色设定'}} as CanvasNodeData;
const old={...text,id:'history',metadata:{status:'loading',studio:{kind:'assistant',request:{clientRequestId:'accepted',nodeId:'history'},conversation:{mode:'general',turns:[{role:'user',content:'讨论角色'}],plan:{steps:[{id:'a',resultNodeId:'text'}]}}}}} as CanvasNodeData;
test('legacy conversation cards migrate out of the graph with accepted task and adoption IDs intact',()=>{
 const result=splitStudioConversations([text,old],[],[{id:'old-edge',fromNodeId:'text',toNodeId:'history'},{id:'kept',fromNodeId:'text',toNodeId:'output'}]);
 expect(result.nodes).toEqual([text]);expect(result.assistantConversations).toEqual([old]);expect(result.connections.map(c=>c.id)).toEqual(['kept']);
 expect(splitStudioConversations(result.nodes,result.assistantConversations,result.connections)).toEqual(result);
});
test('saved sidecar history wins over duplicate legacy cards without multiplying conversations',()=>{
 const latest={...old,title:'已更新的对话'};
 expect(splitStudioConversations([old,text],[latest]).assistantConversations).toEqual([latest]);
});
