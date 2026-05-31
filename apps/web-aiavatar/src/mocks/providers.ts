import type { AiAvatarProviderHealth } from "@ai-star-eco/types/ai-avatar";

/**
 * Provider 健康（mock 视图，与 server /api/aiavatar/health/providers 同形）。
 * faceWarp 是真实确定性算法（任务书 §4），其余 mock —— 前端据此显示 MOCK 角标。
 */
export const PROVIDER_HEALTH: AiAvatarProviderHealth[] = [
  m("faceClone", "真人复刻打样", "扩散模型(ID 保持) · InstantID/IP-Adapter-FaceID"),
  m("txt2img", "AI 原创打样", "文生图 · SDXL/FLUX"),
  m("img2img", "草稿指令调整", "图生图/指令编辑 · InstructPix2Pix"),
  {
    capability: "faceWarp", capabilityLabel: "几何微调", mode: "selfhost", healthy: true,
    engine: "liquify-canvas(TPS-approx)", approach: "MediaPipe FaceMesh + TPS/liquify（确定性，真实算法）",
    message: "前端 canvas 实时液化 · 真实像素形变",
  },
  m("inpaint", "局部重绘", "SD Inpainting + ControlNet + 分割 mask"),
  m("makeup", "妆容迁移", "EleGANt/BeautyGAN/SCGAN"),
  m("hair", "发型变换", "HairCLIP/Barbershop/StableHair"),
  m("restore", "美颜/质感", "GFPGAN/CodeFormer + 美白磨皮"),
  m("img23d", "2D→3D", "TripoSR（简易） / FLAME+3DGS（高精）"),
  m("img2video", "场景渲染短视频", "SVD-XT / AnimateDiff（仅运镜）"),
  m("faceDetect", "人脸合规检测", "InsightFace(RetinaFace) · 遮挡/模糊/多脸"),
  m("nlu", "人设文案解析", "后端 LLM 网关 · 描述词→结构化人设"),
  m("segment", "局部区域分割", "SAM / face-parsing(BiSeNet)"),
];

function m(capability: AiAvatarProviderHealth["capability"], label: string, approach: string): AiAvatarProviderHealth {
  return {
    capability, capabilityLabel: label, mode: "mock", healthy: true,
    engine: "MOCK", approach, message: "MOCK ready（演示模式）",
  };
}
