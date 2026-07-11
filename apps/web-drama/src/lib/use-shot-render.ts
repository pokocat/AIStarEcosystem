// ─────────────────────────────────────────────────────────────────────────────
// lib/use-shot-render.ts — 逐镜渲染共享引擎（C-3 一致性引擎 L1，收敛 P-6）。
//
// 把此前 epscript.tsx 与 shorts/make 各自复制的「参考图装配（shotRefImages / sceneRefUrlFor /
// prevFrameInScene / nextFrameInScene）+ 提交 + 轮询」下沉为一处：参考装配已移到服务端
// （render body 传 shot_ref / ref_slots，服务端按 payloadJson + drama_character/scene 实体自装配、
// 按端点 capability 裁剪、回报 applied_refs）；本 hook 只负责把镜头坐标 + 出片模型选择打包进
// RenderApi 调用 + 统一轮询。放 lib 而非 stage 目录，两线（工作台分镜表 / 短视频工坊）都消费它。
// ─────────────────────────────────────────────────────────────────────────────
import * as React from "react";
import * as RenderApi from "@/api/render";
import type {
  DramaEpisodeJob,
  DramaFrameJob,
  RefSlotsInput,
  RenderFrameResult,
  ShotRefInput,
} from "@/api/render";
import { useRenderModels, type RenderModelsState } from "@/components/drama-workshop/render-model-select";

export interface UseShotRenderOptions {
  /** 当前项目 / 短视频草稿 ID（进 shot_ref.project_id + render body.project_id）。 */
  projectId?: string;
  ratio?: string;
  /** shot=工作台分镜（drama.*_image/video）/ short=短视频（drama.short_*）。 */
  kind?: "shot" | "short";
}

export interface FrameArgs {
  vars: Record<string, string>;
  count?: number;
  name?: string;
  sceneId?: string;
  shotId?: string;
  episodeNo?: number;
  /** 工作台：镜头坐标 → 服务端自装配（角色/场景/上一镜末帧）。 */
  shotRef?: ShotRefInput;
  /** 短视频：结构化显式槽位（主角/场景参考）。 */
  refSlots?: RefSlotsInput;
  /** 拆镜末帧出图的置顶锚（本镜首帧）。 */
  refLeading?: string[];
}

export interface ClipArgs {
  vars: Record<string, string>;
  name?: string;
  durationSec?: number;
  sceneId?: string;
  shotId?: string;
  episodeNo?: number;
  target?: string;
  /** 本镜已锁首帧（in-memory，服务端优先用它，缺则按 shotRef 从文档派生）。 */
  frameUrl?: string;
  /** 本镜末帧（拆镜产物）。 */
  lastFrameUrl?: string;
  shotRef?: ShotRefInput;
}

export interface UseShotRender {
  /** 出片模型选择态（供 RenderModelSelect 渲染 + 透传 endpointId）。 */
  models: RenderModelsState;
  /** 后台首帧任务（工作台分镜表：提交后轮询）。 */
  submitFrameJob(args: FrameArgs): Promise<DramaFrameJob>;
  /** 同步出图（拆镜末帧一次性出 1 版）。 */
  renderFrame(args: FrameArgs): Promise<RenderFrameResult>;
  /** 视频出片（返回提交卡，applied_refs 在卡上；随后 pollClip）。 */
  renderClip(args: ClipArgs): Promise<DramaEpisodeJob>;
  pollFrame(jobId: string): Promise<DramaFrameJob>;
  pollClip(jobId: string): Promise<DramaEpisodeJob>;
}

const POLL_TIMEOUT = 240_000;

export function useShotRender(opts: UseShotRenderOptions): UseShotRender {
  const models = useRenderModels();
  const { projectId, ratio, kind = "shot" } = opts;

  const submitFrameJob = React.useCallback(
    (args: FrameArgs) =>
      RenderApi.submitFrameJob({
        kind,
        vars: args.vars,
        ratio,
        count: args.count,
        projectId,
        sceneId: args.sceneId ?? args.shotRef?.sceneId,
        shotId: args.shotId ?? args.shotRef?.shotId,
        episodeNo: args.episodeNo ?? args.shotRef?.episodeNo,
        name: args.name,
        shotRef: args.shotRef,
        refSlots: args.refSlots,
        refLeading: args.refLeading,
        endpointId: models.imageEndpointId,
      }),
    [kind, ratio, projectId, models.imageEndpointId],
  );

  const renderFrame = React.useCallback(
    (args: FrameArgs) =>
      RenderApi.renderFrame({
        kind,
        vars: args.vars,
        ratio,
        count: args.count ?? 1,
        projectId,
        shotRef: args.shotRef,
        refSlots: args.refSlots,
        refLeading: args.refLeading,
        endpointId: models.imageEndpointId,
      }),
    [kind, ratio, projectId, models.imageEndpointId],
  );

  const renderClip = React.useCallback(
    (args: ClipArgs) =>
      RenderApi.renderClip({
        kind,
        vars: args.vars,
        name: args.name,
        durationSec: args.durationSec,
        ratio,
        projectId,
        sceneId: args.sceneId ?? args.shotRef?.sceneId,
        shotId: args.shotId ?? args.shotRef?.shotId,
        episodeNo: args.episodeNo ?? args.shotRef?.episodeNo,
        target: args.target,
        frameUrl: args.frameUrl,
        lastFrameUrl: args.lastFrameUrl,
        shotRef: args.shotRef,
        endpointId: models.videoEndpointId,
      }),
    [kind, ratio, projectId, models.videoEndpointId],
  );

  const pollFrame = React.useCallback((jobId: string) => RenderApi.pollFrameJob(jobId, { timeoutMs: POLL_TIMEOUT }), []);
  const pollClip = React.useCallback((jobId: string) => RenderApi.pollClipJob(jobId, { timeoutMs: POLL_TIMEOUT }), []);

  return { models, submitFrameJob, renderFrame, renderClip, pollFrame, pollClip };
}
