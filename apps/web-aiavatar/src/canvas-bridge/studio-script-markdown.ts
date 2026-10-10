import type { StudioScript } from '@ai-star-eco/types/ip-studio-workflow';
import { scriptHeadingText } from './studio-script-rich-extensions';

export const scriptSections = ['故事大纲','人物小传','场景设计','道具设计','分集剧本'] as const;
export const SCRIPT_DOCUMENT_LIMIT = 48000;

/** These headings are the document contract; body Markdown is preserved verbatim in the canvas. */
export function scriptFramework(title='新剧本') {
  return `# ${title}\n\n## 故事大纲\n\n故事背景：\n核心冲突：\n故事发展：\n结局与主题：\n\n## 人物小传\n\n### 主角\n\n身份与外貌：\n性格与目标：\n人物关系：\n成长变化：\n\n## 场景设计\n\n### 主要场景\n\n地点与时间：\n环境与氛围：\n视觉特征：\n\n## 道具设计\n\n### 关键道具\n\n外观与材质：\n剧情作用：\n\n## 分集剧本\n\n### 第 1 集 · 开场\n\n#### 场次 1\n\n场景：\n时间：\n出场人物：\n\n**动作**：\n\n**对白**：\n\n**本集悬念**：\n`;
}

export function scriptToMarkdown(script: StudioScript) {
  const items=(list:StudioScript['characters'])=>list.map(item=>`### ${item.name}\n\n${item.description}`).join('\n\n');
  return `# ${script.title}\n\n## 故事大纲\n\n${script.outline}\n\n## 人物小传\n\n${items(script.characters)}\n\n## 场景设计\n\n${items(script.scenes)}\n\n## 道具设计\n\n${items(script.props)}\n\n## 分集剧本\n\n${script.episodes.map(e=>`### 第 ${e.no} 集 · ${e.title}\n\n${e.content}`).join('\n\n')}\n`;
}

/** Ignore headings inside fenced code; an embedded example is never a new episode or section. */
export function markdownHeadings(markdown:string) {
  const headings:{level:number;title:string;start:number;end:number}[]=[];
  let offset=0,fence:string|undefined;
  for(const line of markdown.split('\n')) {
    const marker=line.match(/^\s*(`{3,}|~{3,})/);
    if(marker){if(!fence)fence=marker[1][0];else if(fence===marker[1][0])fence=undefined;}
    else if(!fence){
      const match=line.match(/^(#{1,6})[ \t]+(.+)$/);
      if(match)headings.push({level:match[1].length,title:scriptHeadingText(match[2].replace(/[ \t]+#+[ \t]*$/, '')),start:offset,end:offset+line.length+1});
    }
    offset+=line.length+1;
  }
  return headings;
}

export function scriptMarkdownError(markdown:string) {
  if(markdown.length>SCRIPT_DOCUMENT_LIMIT)return `剧本文档最多 ${SCRIPT_DOCUMENT_LIMIT.toLocaleString()} 字，请分集编辑`;
  const headings=markdownHeadings(markdown);
  if(!headings.some(h=>h.level===1&&h.title.trim()))return '请保留一级标题作为剧本名称';
  const missing=scriptSections.filter(s=>!headings.some(h=>h.level===2&&h.title===s));
  if(missing.length)return `请保留剧本框架章节：${missing.join('、')}`;
  if(scriptSections.some(s=>headings.filter(h=>h.level===2&&h.title===s).length!==1))return '剧本框架章节不能重复';
  const section=headings.find(h=>h.level===2&&h.title==='分集剧本')!;
  const end=headings.find(h=>h.level<=2&&h.start>section.start)?.start??markdown.length;
  const episodeHeadings=headings.filter(h=>h.level===3&&h.start>section.start&&h.start<end);
  const numbers=episodeHeadings.map(h=>h.title.match(/^第\s*(\d+)\s*集(?:\s*[·：:—-]\s*(.*))?$/)?.[1]);
  if(!numbers.length||numbers.some(n=>!n||Number(n)<1||Number(n)>50)||new Set(numbers.map(Number)).size!==numbers.length)return '分集请使用“分集 / 人物标题”样式，名称如“第 1 集 · 标题”，集号需唯一且在 1–50 之间';
  return undefined;
}

export function markdownToScript(markdown:string,previous?:StudioScript):StudioScript {
  const headings=markdownHeadings(markdown);
  const section=(name:string)=>{
    const heading=headings.find(h=>h.level===2&&h.title===name);
    if(!heading)return '';
    const end=headings.find(h=>h.level<=2&&h.start>heading.start)?.start??markdown.length;
    return markdown.slice(heading.end,end).trim();
  };
  const items=(name:string)=>{
    const body=section(name),entries=markdownHeadings(body).filter(h=>h.level===3);
    // Unheaded prose still has a downstream home; it is not silently thrown away.
    const preamble=body.slice(0,entries[0]?.start??body.length).trim();
    return [...(preamble?[{name:`${name}补充`,description:preamble}]:[]),...entries.map((h,i)=>({name:h.title,description:body.slice(h.end,entries[i+1]?.start??body.length).trim()}))];
  };
  const body=section('分集剧本'),episodes=markdownHeadings(body).filter(h=>h.level===3);
  return {title:headings.find(h=>h.level===1)?.title||previous?.title||'新剧本',outline:section('故事大纲'),characters:items('人物小传'),scenes:items('场景设计'),props:items('道具设计'),
    episodes:episodes.map((h,i)=>{const match=h.title.match(/^第\s*(\d+)\s*集(?:\s*[·：:—-]\s*(.*))?$/);return {no:Number(match?.[1]||i+1),title:match?.[2]||h.title,content:body.slice(h.end,episodes[i+1]?.start??body.length).trim()};}),shots:previous?.shots||[]};
}

export function applyScriptProposal(current:string,proposal:{markdown:string;baseMarkdown:string}) {
  if(current!==proposal.baseMarkdown)return {error:'AI 回复期间正文已修改。请先比较差异，再明确采用 AI 版本。'};
  const error=scriptMarkdownError(proposal.markdown);
  return error?{error}:{markdown:proposal.markdown};
}
