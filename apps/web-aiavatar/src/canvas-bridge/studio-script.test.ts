import { describe,expect,it } from "vitest";
import type { StudioScript } from "@ai-star-eco/types/ip-studio-workflow";
import { makeStudioNode } from "./studio-nodes";
import { markStudioDescendants,mergeStudioRewrite,reorderStudioClips,studioNodeReferences,studioScriptPrompt,studioShotNodes } from "./studio-script";
const script:StudioScript={title:"已编辑的标题",outline:"大纲",characters:[],scenes:[],props:[],episodes:[{no:1,title:"正文",content:"已修改的正文"}],shots:[{id:"stable-shot",title:"旧建议",description:"旧建议画面",dialogue:"",durationSec:8,characters:[]}]};
describe("Studio inputs and adoption",()=>{
  it("splits the edited body and excludes obsolete first-generation shot suggestions",()=>{
    const prompt=studioScriptPrompt(script,"拆分镜头");expect(prompt).toContain("已修改的正文");expect(prompt).not.toContain("旧建议画面");
  });
  it("materializes stable shot identities and carries chosen IP references",()=>{
    const parent=makeStudioNode("storyboard");parent.metadata!.studio!.references=[{storageKey:"main.jpg",role:"character",ipId:"ip",avatarId:"a",version:1}];
    const shot=studioShotNodes(parent,script)[0];expect(shot.metadata?.studio?.shot?.id).toBe("stable-shot");expect(shot.metadata?.studio?.parentNodeId).toBe(parent.id);expect(shot.metadata?.studio?.references).toEqual(parent.metadata?.studio?.references);
  });
  it("choosing a generated take does not falsely claim it is the IP's adopted version",()=>{
    const node=makeStudioNode("image");node.metadata!.storageKey="candidate.jpg";node.metadata!.studio!.adoption={ipId:"ip",avatarId:"a",version:1,storageKey:"main.jpg"};
    expect(studioNodeReferences(node,"frame")[0]).toEqual({storageKey:"candidate.jpg",role:"frame",ipId:undefined,avatarId:undefined,version:undefined,lookId:undefined});
  });
  it("normalizes every clip order when clips previously had no order",()=>{
    const clips=[makeStudioNode("video"),makeStudioNode("video"),makeStudioNode("video")];const result=reorderStudioClips(clips,clips.map(n=>n.id),2,1);
    expect(result.map(n=>n.metadata?.studio?.order)).toEqual([0,2,1]);
  });
  it("keeps old outputs and marks every dependent generation after upstream editing",()=>{
    const root=makeStudioNode("script"),board=makeStudioNode("storyboard",root),shot=makeStudioNode("image",board),video=makeStudioNode("video",shot),other=makeStudioNode("image");
    for(const [node,parent] of [[board,root],[shot,board],[video,shot]])node.metadata!.studio!.parentNodeId=parent.id;
    video.metadata!.storageKey="old-video.mp4";
    const result=markStudioDescendants([root,board,shot,video,other],root.id);
    expect(result.slice(1,4).every(n=>n.metadata?.studio?.upstreamChanged)).toBe(true);
    expect(result[3].metadata?.storageKey).toBe("old-video.mp4");expect(result[4]).toBe(other);
    const work=makeStudioNode("assemble");work.metadata!.studio!.references=[{storageKey:"old-video.mp4",role:"clip"}];
    expect(markStudioDescendants([...result,work],root.id)[5].metadata?.studio?.upstreamChanged).toBe(true);
  });
  it("rewriting episode two preserves episode one and its authored shots",()=>{
    const first={...script.shots[0],episodeNo:1},second={...script.shots[0],id:"ep2",episodeNo:2};
    const base={...script,episodes:[...script.episodes,{no:2,title:"第二集",content:"原正文"}],shots:[first,second]};
    const generated={...script,episodes:[{no:2,title:"模型标题",content:"新正文"}]};
    const result=mergeStudioRewrite(base,generated,{field:"episode",episodeNo:2});
    expect(result.episodes[0]).toBe(base.episodes[0]);expect(result.episodes[1].content).toBe("新正文");expect(result.shots).toEqual([first]);
  });
  it("partial rewriting preserves all other episodes and character settings",()=>{
    const base={...script,episodes:[...script.episodes,{no:2,title:"第二集",content:"保留这段正文"}]};
    const generated={...script,title:"模型改了标题",characters:[{name:"另一个人",description:""}],episodes:[{no:1,title:"新标题",content:"改写正文"}]};
    const result=mergeStudioRewrite(base,generated,{field:"episode",episodeNo:1});
    expect(result.title).toBe(base.title);expect(result.characters).toBe(base.characters);expect(result.episodes[1]).toBe(base.episodes[1]);expect(result.episodes[0].content).toBe("改写正文");expect(result.shots).toEqual([]);
  });
});

it('editing a bound story marks its adaptation and all derived outputs without changing them',()=>{
  const original=makeStudioNode('script'),adapted=makeStudioNode('script'),board=makeStudioNode('storyboard'),clip=makeStudioNode('video');
  adapted.metadata!.studio!.scriptSourceNodeId=original.id;board.metadata!.studio!.parentNodeId=adapted.id;clip.metadata!.studio!.parentNodeId=board.id;clip.metadata!.storageKey='existing-work.mp4';
  const next=markStudioDescendants([original,adapted,board,clip],original.id);
  expect(next.slice(1).every(n=>n.metadata?.studio?.upstreamChanged)).toBe(true);expect(next[3].metadata?.storageKey).toBe('existing-work.mp4');expect(adapted.metadata!.studio!.upstreamChanged).toBeUndefined();
});
