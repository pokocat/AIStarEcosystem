import type { IpRun } from '@ai-star-eco/types';
import type { StudioRunRequest } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';

// These titles are the server's submission snapshot, not the conversation's latest plan.
type TaskInputs = IpRun['inputs'] & Partial<StudioRunRequest> & {
  appliedCanvasContext?: { id: string; title: string; type: string }[];
};
const operations: Record<string, string> = {
  text: '修改正文', script: '创作剧本', storyboard: '拆分镜头', image: '生成图片',
  video: '生成视频', assemble: '合成作品', audio: '生成配音', 'lip-sync': '口型同步',
  'asset-extract': '提取资产', adopt: '保存 IP 形象', identity: '生成角色设定', generate: '生成图片',
};
const clean = (text?: string) => text?.replace(/\s+/g, ' ').trim() || '';
const names = (items: string[]) => [...new Set(items.filter(Boolean))].slice(0, 3).join('、');

export function studioTaskPresentation(run: IpRun, nodes: CanvasNodeData[]): { title: string; detail: string } {
  const inputs = run.inputs as TaskInputs;
  const request = inputs.studioRequest || inputs;
  const detail = clean(inputs.userPrompt || request.prompt);
  const operation = request.operation || run.kind.replace(/^studio-/, '');
  const titleOf = (id: string) => clean(inputs.appliedCanvasContext?.find(n => n.id === id)?.title)
    || clean(nodes.find(n => n.id === id && !n.metadata?.studio?.conversation)?.title) || '已移除节点';
  if (operation === 'assistant') {
    const steps = run.output.plan?.steps || [];
    const edits = steps.filter(step => step.editTarget);
    if (edits.length) {
      const actions = names(edits.map(step => step.editTarget!.field === 'prompt' ? '修改提示词' : step.editTarget!.field === 'script' ? '修改剧本' : '修改正文'));
      return { title: `${actions} · ${names(edits.map(step => titleOf(step.editTarget!.nodeId)))}`, detail };
    }
    if (steps.length) {
      const action = steps.length > 1 ? '规划创作流程' : steps[0].operation === 'text' ? '创作文字' : `规划${({ script: '剧本', storyboard: '镜头', image: '图片', video: '视频' } as Record<string, string>)[steps[0].operation] || '创作'}`;
      return { title: `${action} · ${names(steps.map(step => clean(step.title)))}`, detail };
    }
    const context = request.contextNodeIds || inputs.appliedCanvasContext?.map(n => n.id) || [];
    // Running and failed tasks have no adopted output; describe only the submitted intent.
    const action = /提示词/.test(detail) ? '修改提示词' : /正文|文案/.test(detail) && context.length ? '修改正文'
      : /剧本/.test(detail) && context.length ? '修改剧本' : 'AI 创作';
    return { title: context.length ? `${action} · ${names(context.map(titleOf))}` : `${action} · ${detail.slice(0, 36) || '新创作'}`, detail };
  }
  const action = operations[operation] || '创作任务';
  const suffix = operation === 'video' && request.durationSec ? ` · ${request.durationSec} 秒` : '';
  return { title: `${action} · ${titleOf(run.nodeId)}${suffix}`, detail };
}
