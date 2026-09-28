"use client";

// 分镜单镜的前端形态（FormShot / ShotFlow）—— 参照「短剧分镜V2(结构化版-适配Web表单)」字段结构:
// 镜号 / 时间线(单镜时长) / 画面内容(纯视觉) / 音频内容(人声+音效+BGM) /
// 镜头参数(景别/运镜) / 特效氛围(画面包装) / 参考素材 / 字幕。
// 渲染渐进：待生成 → 首帧 → 视频（待确认）→ 已确认。短剧分镜表与短视频分镜表共用。
//
// v0.197：原来这里还有一个 ShotFormCard（逐镜表单卡），早已没有任何页面挂载，却写死了过时的价格
// （首帧 2 / 直出 9 / 视频 7）和旧说法，连带 script-refs.tsx（「@ 引用素材」只挂在它身上）一起删掉了。
// 真正在用的逐镜单元是 storyboard-table.tsx 的 ShotFrameCell。
import type { Material } from "@/mocks/drama-workshop";

export type ShotFlow = "draft" | "frame" | "clip" | "done";

export interface FormShot {
  id: string;
  no: number;
  /** 单镜时长(秒) */
  dur: number;
  /** 画面内容(纯视觉) */
  visual: string;
  /** 景别 */
  size: string;
  /** 运镜 */
  move: string;
  /** 人声:说话人(旁白/角色/口播…) */
  voWho: string;
  /** 人声:台词文本 */
  voText: string;
  /** 音效 */
  sfx: string;
  /** BGM */
  bgm: string;
  /** 特效氛围(画面包装) */
  fx: string;
  refs: Material[];
  sub: boolean;
  flow: ShotFlow;
  /** v0.97：出场角色 id（用于按镜挑角色参考图，锁人物一致性）。 */
  cast?: string[];
  /**
   * v0.143 短视频提示词直出：本镜出场人物**名字**（对应 visualBible.characters[].name）。
   * 与上面的 `cast`（短剧线的角色实体 id）刻意分开，避免两条线语义串。
   * 显式空数组 = 本镜没有人物；字段缺失 = 未标注，服务端按全员锚定。
   */
  castNames?: string[];
  /** v0.97：机位标识（同机位复用同值，跨镜保持取景一致）。 */
  camId?: string;
  /** v0.65 真实渲染产物 */
  frameUrls?: string[];
  frameUrl?: string;
  videoUrl?: string;
  jobId?: string;
  /** v0.97 P2：成片真实末帧（seedance return_last_frame）→ 下一镜首帧参考，链式承接。 */
  lastFrameUrl?: string;
  /** v0.97 P2 镜头分解（借鉴 ViMax）：首/末帧静态快照 + 运动 + 变化等级 + 末帧关键帧图。 */
  ffDesc?: string;
  lfDesc?: string;
  motionDesc?: string;
  variationType?: "small" | "medium" | "large" | string;
  endFrameUrl?: string;
  /** C-1（一致性引擎）：上次首帧/出片的参考生效回报（参考 N/M 生效），render 回填。 */
  appliedRefs?: import("@/api/render").AppliedRefs;
  /**
   * v0.197：后台任务对账的分界（服务端时间 ISO）—— 这之后创建的任务才算这一镜的。
   * 出新首帧时 = 那次首帧任务的 created_at；新建镜头时 = 当时已知任务里最新的 created_at。
   * 规则见 stages/epscript-recovery.ts。
   */
  resetAt?: string;
}
