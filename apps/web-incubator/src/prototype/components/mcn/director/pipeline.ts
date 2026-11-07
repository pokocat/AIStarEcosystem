/**
 * Production progress derived from project state, shared by the 流程 step rail, the chat's live
 * one-click card and AI-follow. Nothing is instrumented: whatever is `generating` right now is
 * where the AI is, in pipeline order.
 */
import { orderedShots, type CanvasNode, type LT, type ProjectMode } from './directorData';
import type { Asset, Episode, StudioView } from './studioModel';

export type StepState = 'todo' | 'running' | 'done' | 'attention';
export interface PipelineStep {
  id: string;
  label: LT;
  state: StepState;
  /** e.g. 2/3, 缺 1 */
  detail?: LT;
  /** Where the step lives in 流程. */
  view: Exclude<StudioView, 'canvas'>;
  /** The canvas node to centre on (the one being worked on, else the step's main node). */
  nodeId?: string;
  assetId?: string;
}

const L = (zh: string, en: string): LT => ({ zh, en });
const count = (done: number, total: number) => L(`${done}/${total}`, `${done}/${total}`);

interface Project { mode: ProjectMode; nodes: CanvasNode[]; episodes: Episode[]; assets: Asset[] }

const assetsStep = ({ nodes, assets }: Project): PipelineStep => {
  const busy = assets.find(a => a.status === 'generating');
  const missing = assets.filter(a => a.status === 'missing').length;
  return {
    id: 'assets', label: L('资产图', 'Assets'), view: 'assets',
    state: busy ? 'running' : !assets.length ? 'todo' : missing ? 'attention' : 'done',
    detail: !assets.length ? undefined : missing && !busy ? L(`缺 ${missing}`, `${missing} missing`) : count(assets.filter(a => a.status === 'confirmed').length, assets.length),
    assetId: busy?.id ?? assets.find(a => a.status === 'missing')?.id,
    nodeId: nodes.find(n => n.kind === 'character')?.id,
  };
};

const shotSteps = (shots: CanvasNode[], label: LT): PipelineStep[] => {
  const framing = shots.find(s => s.status === 'generating');
  const rendering = shots.find(s => s.videoStatus === 'generating');
  const framed = shots.filter(s => s.image && s.status === 'done').length;
  const rendered = shots.filter(s => s.videoStatus === 'done').length;
  return [
    {
      id: 'frames', label, view: 'storyboard', detail: count(framed, shots.length),
      state: framing ? 'running' : shots.length && framed === shots.length ? 'done' : 'todo',
      nodeId: (framing ?? shots.find(s => !s.image) ?? shots[0])?.id,
    },
    {
      id: 'videos', label: L('视频', 'Video'), view: 'storyboard', detail: count(rendered, shots.length),
      state: rendering ? 'running' : shots.length && rendered === shots.length ? 'done' : 'todo',
      nodeId: (rendering ?? shots.find(s => s.videoStatus !== 'done') ?? shots[0])?.id,
    },
  ];
};

const nodeStep = (id: string, label: LT, node: CanvasNode | undefined, view: PipelineStep['view']): PipelineStep => ({
  id, label, view, nodeId: node?.id,
  state: node?.status === 'generating' ? 'running' : node?.status === 'done' ? 'done' : 'todo',
});

/** The steps of a one-click run, in order. */
export const pipelineFor = (p: Project): PipelineStep[] => {
  const shots = orderedShots(p.nodes);
  const output = p.nodes.find(n => n.kind === 'output');
  const final = nodeStep('final', L('成片', 'Final'), output, 'final');
  if (p.mode === 'music') {
    // Only the sound stages this project actually has.
    return [
      ...[
        nodeStep('lyrics', L('歌词', 'Lyrics'), p.nodes.find(n => n.kind === 'lyrics'), 'script'),
        nodeStep('audio', L('编曲', 'Arrangement'), p.nodes.find(n => n.kind === 'audio'), 'final'),
        nodeStep('vocal', L('人声', 'Vocals'), p.nodes.find(n => n.kind === 'vocal'), 'final'),
      ].filter(s => s.nodeId),
      ...(shots.length ? shotSteps(shots, L('MV 画面', 'MV frames')) : []),
      final,
    ];
  }
  const writing = p.episodes.some(e => e.status === 'generating');
  const script: PipelineStep = {
    id: 'script', label: L('剧本', 'Script'), view: 'script', nodeId: p.nodes.find(n => n.kind === 'script')?.id,
    state: writing ? 'running' : p.episodes.some(e => e.body) ? 'done' : 'todo',
  };
  return [script, assetsStep(p), ...shotSteps(shots, L('分镜图', 'Frames')), final];
};

/** What the AI is working on right now (the first running step), or null when idle. */
export const currentActivity = (steps: PipelineStep[]) => steps.find(s => s.state === 'running') ?? null;

/** Status of each 流程 view for the step rail. */
export const flowStatus = (steps: PipelineStep[], mode: ProjectMode, assets: Asset[]): Record<PipelineStep['view'], { state: StepState; detail?: LT }> => {
  const pick = (ids: string[]) => steps.filter(s => ids.includes(s.id));
  const merge = (list: PipelineStep[], detailFrom?: PipelineStep) => ({
    state: list.some(s => s.state === 'running') ? 'running' as const
      : list.length && list.every(s => s.state === 'done') ? 'done' as const
        : list.some(s => s.state === 'attention') ? 'attention' as const : 'todo' as const,
    detail: detailFrom?.detail,
  });
  const a = assetsStep({ mode, nodes: [], episodes: [], assets });
  return {
    script: merge(pick(mode === 'music' ? ['lyrics'] : ['script'])),
    assets: { state: a.state, detail: a.detail },
    // Shows whichever count is moving: frames while drawing, otherwise videos.
    storyboard: merge(pick(['frames', 'videos']), steps.find(s => s.id === 'frames' && s.state === 'running') ?? steps.find(s => s.id === 'videos')),
    final: merge(pick(mode === 'music' ? ['audio', 'vocal', 'final'] : ['final'])),
  };
};
