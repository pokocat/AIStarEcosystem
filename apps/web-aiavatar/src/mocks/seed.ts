// ============================================================
// seed.ts — Mock 初始数据，用「较为真实的开源人像图片」(public/seed/portrait-*.jpg) 落地。
// 覆盖 8 态状态机 + 版本时间线 + 标准图集 + 真人授权 + 异步任务，让总库一进来即有内容。
// 图片来源：Unsplash（免费可用），已下载到 public/seed/，离线可跑。
// ============================================================
import type {
  AiAvatar,
  AiAvatarAsset,
  AiAvatarVersion,
  AiAvatarSourceMaterial,
  AiAvatarLicenseGrant,
  AiAvatarTemplate,
  AiAvatarJob,
  AiAvatarStandardShot,
  AiAvatarCreationMode,
  AiAvatarStatus,
} from "@ai-star-eco/types/ai-avatar";

export const OWNER = "aiavatar-demo-user";

/** 12 张真实开源人像（public/seed/）。 */
export const PORTRAITS = Array.from({ length: 12 }, (_, i) => `/seed/portrait-${i + 1}.jpg`);

const t = (daysAgo: number, hoursAgo = 0) =>
  new Date(Date.now() - daysAgo * 864e5 - hoursAgo * 36e5).toISOString();

interface AvatarSpec {
  id: string;
  name: string;
  mode: AiAvatarCreationMode;
  status: AiAvatarStatus;
  style: string;
  tags: string[];
  has3d: boolean;
  hasVideo: boolean;
  portrait: number; // index into PORTRAITS
  daysAgo: number;
  persona: string;
}

const SPECS: AvatarSpec[] = [
  { id: "DH-2049", name: "林夕", mode: "real_clone", status: "archived", style: "写实主播风", tags: ["带货主播", "商用"], has3d: true, hasVideo: true, portrait: 0, daysAgo: 13, persona: "25 岁女带货主播，圆脸，温柔气质，休闲职业装，写实风格" },
  { id: "DH-2051", name: "Aria", mode: "ai_original", status: "archived", style: "二次元", tags: ["品牌IP", "泛娱乐"], has3d: true, hasVideo: false, portrait: 4, daysAgo: 15, persona: "二次元品牌虚拟形象，大眼立体，元气活泼" },
  { id: "DH-2047", name: "苏野", mode: "real_clone", status: "finalized_2d", style: "轻奢风", tags: ["个人分身"], has3d: false, hasVideo: false, portrait: 6, daysAgo: 17, persona: "都市轻奢气质，质感妆容，时尚分身" },
  { id: "DH-2044", name: "夜阑", mode: "ai_original", status: "archived", style: "国风", tags: ["虚拟角色", "AI原创"], has3d: false, hasVideo: true, portrait: 2, daysAgo: 20, persona: "国风虚拟角色，东方韵味，古典妆造" },
  { id: "DH-2052", name: "可乐", mode: "ai_original", status: "refining", style: "科幻", tags: ["泛娱乐"], has3d: false, hasVideo: false, portrait: 10, daysAgo: 9, persona: "科幻未来感人设，金属机能风" },
  { id: "DH-2053", name: "初见", mode: "real_clone", status: "sampling", style: "简约风", tags: ["主播复刻", "商用"], has3d: false, hasVideo: false, portrait: 8, daysAgo: 7, persona: "干净通勤简约风，职业感主播复刻" },
  { id: "DH-2040", name: "墨白", mode: "ai_original", status: "archived", style: "写实", tags: ["品牌IP"], has3d: true, hasVideo: true, portrait: 5, daysAgo: 23, persona: "写实品牌 IP 男性形象，沉稳可信" },
  { id: "DH-2055", name: "星野", mode: "real_clone", status: "draft", style: "轻奢风", tags: ["个人分身"], has3d: false, hasVideo: false, portrait: 7, daysAgo: 5, persona: "轻奢气质个人分身，待打样" },
  { id: "DH-2038", name: "Nova", mode: "ai_original", status: "archived", style: "科幻", tags: ["虚拟主播", "AI原创"], has3d: true, hasVideo: false, portrait: 11, daysAgo: 26, persona: "利落中性风未来虚拟主播" },
];

const SHOT_LABELS: { shot: AiAvatarStandardShot; label: string }[] = [
  { shot: "front_bust", label: "正面半身像" },
  { shot: "front_full", label: "正面全身像" },
  { shot: "left_profile", label: "左侧脸特写" },
  { shot: "right_profile", label: "右侧脸特写" },
  { shot: "expression", label: "微笑表情" },
];

export interface SeedData {
  avatars: AiAvatar[];
  assets: AiAvatarAsset[];
  versions: AiAvatarVersion[];
  sourceMaterials: AiAvatarSourceMaterial[];
  licenses: AiAvatarLicenseGrant[];
  templates: AiAvatarTemplate[];
  jobs: AiAvatarJob[];
}

function asset(partial: Partial<AiAvatarAsset> & Pick<AiAvatarAsset, "id" | "kind" | "fileUrl">): AiAvatarAsset {
  return {
    avatarId: null,
    versionId: null,
    standardShot: null,
    thumbnailUrl: null,
    mimeType: "image/jpeg",
    width: 1080,
    height: 1440,
    fileSize: 820_000,
    durationSec: 0,
    format3d: null,
    engine: null,
    providerMode: null,
    watermarkToken: null,
    encrypted: false,
    meta: null,
    createdAt: t(1),
    ...partial,
  };
}

export function buildSeed(): SeedData {
  const avatars: AiAvatar[] = [];
  const assets: AiAvatarAsset[] = [];
  const versions: AiAvatarVersion[] = [];
  const sourceMaterials: AiAvatarSourceMaterial[] = [];
  const licenses: AiAvatarLicenseGrant[] = [];
  const jobs: AiAvatarJob[] = [];

  for (const s of SPECS) {
    const created = t(s.daysAgo);
    const updated = t(Math.max(0, s.daysAgo - 4));
    const isDone = s.status === "archived" || s.status === "finalized_2d";
    const coverUrl = PORTRAITS[s.portrait % PORTRAITS.length];
    const coverId = `${s.id}-cover`;

    // 封面 / 正面半身
    assets.push(
      asset({
        id: coverId,
        avatarId: s.id,
        kind: "image_2d",
        standardShot: "front_bust",
        fileUrl: coverUrl,
        thumbnailUrl: coverUrl,
        engine: s.mode === "real_clone" ? "InstantID" : "SDXL",
        providerMode: "mock",
        createdAt: updated,
      }),
    );

    // 已定稿 / 归档 → 完整标准图集
    if (isDone) {
      SHOT_LABELS.slice(1).forEach((sl, i) => {
        // front_full 用真实照片（不同裁切）；profile/expression 用占位（无多角度真实素材）。
        const useReal = sl.shot === "front_full";
        assets.push(
          asset({
            id: `${s.id}-${sl.shot}-${i}`,
            avatarId: s.id,
            kind: sl.shot === "expression" ? "expression_image" : "image_2d",
            standardShot: sl.shot,
            fileUrl: useReal ? coverUrl : "",
            engine: "GFPGAN",
            providerMode: "mock",
            createdAt: updated,
          }),
        );
      });
    }

    if (s.has3d) {
      assets.push(
        asset({
          id: `${s.id}-3d`,
          avatarId: s.id,
          kind: "model_3d",
          fileUrl: `/seed/placeholder.glb`,
          format3d: "glb",
          mimeType: "model/gltf-binary",
          fileSize: 4_800_000,
          engine: "TripoSR",
          providerMode: "mock",
          createdAt: updated,
        }),
      );
    }
    if (s.hasVideo) {
      assets.push(
        asset({
          id: `${s.id}-video`,
          avatarId: s.id,
          kind: "video",
          fileUrl: "",
          mimeType: "video/mp4",
          durationSec: 20,
          width: 1920,
          height: 1080,
          fileSize: 12_400_000,
          engine: "Stable Video Diffusion",
          providerMode: "mock",
          createdAt: updated,
        }),
      );
    }

    // 源素材
    if (s.mode === "real_clone") {
      for (let i = 0; i < 3; i++) {
        sourceMaterials.push({
          id: `${s.id}-src-${i}`,
          avatarId: s.id,
          kind: "photo",
          assetId: `${s.id}-srcasset-${i}`,
          assetUrl: coverUrl,
          text: null,
          faceCheck: { faces: 1, occlusion: false, blur: false, multiFace: false, brightness: "good", passed: true, engine: "InsightFace(RetinaFace)" },
          faceCheckPassed: true,
          createdAt: created,
        });
      }
      // 授权
      const validFrom = created;
      const validTo = t(s.daysAgo - 365 * 3);
      const expiringSoon = s.id === "DH-2047";
      licenses.push({
        id: `${s.id}-lic`,
        avatarId: s.id,
        subjectName: s.name,
        scope: "commercial",
        platforms: ["全平台"],
        validFrom,
        validTo: expiringSoon ? t(-80) : validTo,
        status: "active",
        hasAgreement: true,
        signatureName: s.name,
        signedAt: created,
        boundAssetIds: [`${s.id}-srcasset-0`, `${s.id}-srcasset-1`, `${s.id}-srcasset-2`],
        credentialUrl: `/seed/license-${s.id}.pdf`,
        createdAt: created,
      });
    } else {
      sourceMaterials.push({
        id: `${s.id}-persona`,
        avatarId: s.id,
        kind: "text",
        assetId: null,
        assetUrl: null,
        text: s.persona,
        faceCheck: null,
        faceCheckPassed: null,
        createdAt: created,
      });
    }

    // 版本时间线
    const vstages: { no: number; label: string; stage: AiAvatarStatus | "drafting" | "pending"; note: string; hAgo: number; author: string }[] =
      s.id === "DH-2049"
        ? [
            { no: 8, label: "定稿 v1.0", stage: "finalized_2d", note: "锁定标准图集", hAgo: 0, author: "陈墨" },
            { no: 7, label: "美化 · 主播美颜", stage: "pending_finalize", note: "叠加冷白皮", hAgo: 0.5, author: "陈墨" },
            { no: 6, label: "精调 v3", stage: "refining", note: "眼睛放大 · 唇色偏淡", hAgo: 1, author: "陈墨" },
            { no: 5, label: "精调 v2", stage: "refining", note: "瘦脸 +12%", hAgo: 1.5, author: "陈墨" },
            { no: 4, label: "草稿 v2", stage: "draft_iterating", note: "换职业装", hAgo: 2, author: "陈墨" },
            { no: 3, label: "草稿 v1", stage: "draft_iterating", note: "淡妆", hAgo: 2.2, author: "陈墨" },
            { no: 2, label: "打样 #3", stage: "sampling", note: "选中方案 C", hAgo: 2.5, author: "系统" },
            { no: 1, label: "原始素材", stage: "draft", note: "上传 4 张照片", hAgo: 3, author: "陈墨" },
          ]
        : [
            { no: 2, label: isDone ? "定稿 v1.0" : "当前版本", stage: s.status, note: isDone ? "锁定标准图集" : "进行中", hAgo: 0, author: "陈墨" },
            { no: 1, label: "原始素材", stage: "draft", note: s.mode === "real_clone" ? "上传参考照片" : "输入人设文案", hAgo: 6, author: "陈墨" },
          ];

    vstages.forEach((v) => {
      versions.push({
        id: `${s.id}-v${v.no}`,
        avatarId: s.id,
        versionNo: v.no,
        label: v.label,
        note: v.note,
        author: v.author,
        sourceStatus: v.stage as AiAvatarStatus,
        params: null,
        previewAssetId: coverId,
        previewUrl: coverUrl,
        assetIds: v.no === Math.max(...vstages.map((x) => x.no)) ? [coverId] : [],
        jobId: null,
        preferred: false,
        discarded: false,
        createdAt: t(Math.max(0, s.daysAgo - 4), v.hAgo * 24),
      });
    });

    const currentVer = `${s.id}-v${Math.max(...vstages.map((x) => x.no))}`;
    avatars.push({
      id: s.id,
      ownerUserId: OWNER,
      studioId: null,
      name: s.name,
      mode: s.mode,
      status: s.status,
      persona: s.persona,
      personaStructured: null,
      styleCategory: s.style,
      coverAssetId: coverId,
      coverUrl,
      currentVersionId: currentVer,
      finalizedVersionId: isDone ? currentVer : null,
      has3d: s.has3d,
      hasVideo: s.hasVideo,
      tags: s.tags,
      forkedFromAvatarId: null,
      createdAt: created,
      updatedAt: updated,
      archivedAt: s.status === "archived" ? updated : null,
    });
  }

  // ── 进行中 / 历史任务（任务中心）─────────────────────────────────────────
  jobs.push(
    job("T-7781", "初见 · 打样生成", "DH-2053", "faceClone", "running", 35, "约 40s"),
    job("T-7779", "可乐 · 精调出图", "DH-2052", "inpaint", "running", 62, "约 25s"),
    job("T-7775", "林夕 · 3D 重建", "DH-2049", "img23d", "succeeded", 100, "已完成"),
    job("T-7770", "夜阑 · 渲染视频", "DH-2044", "img2video", "succeeded", 100, "已完成"),
    job("T-7768", "Aria · 标准出图", "DH-2051", "restore", "failed", 0, "生成失败"),
  );

  return { avatars, assets, versions, sourceMaterials, licenses, templates: buildTemplates(), jobs };
}

function job(
  id: string,
  title: string,
  avatarId: string,
  capability: AiAvatarJob["capability"],
  status: AiAvatarJob["status"],
  progress: number,
  _eta: string,
): AiAvatarJob {
  return {
    id,
    ownerUserId: OWNER,
    avatarId,
    versionId: null,
    capability,
    status,
    progress,
    providerMode: "mock",
    engine: "MOCK",
    title,
    input: null,
    result: status === "succeeded" ? { assetIds: [`${avatarId}-cover`] } : null,
    errorMessage: status === "failed" ? "上游推理超时（mock 演示）" : null,
    attempts: status === "failed" ? 1 : status === "succeeded" ? 1 : 0,
    maxAttempts: 3,
    creditsHeld: 0,
    batchId: null,
    createdAt: t(0, status === "running" ? 0.1 : 2),
    startedAt: status === "queued" ? null : t(0, status === "running" ? 0.1 : 2),
    completedAt: status === "succeeded" || status === "failed" ? t(0, 1) : null,
  };
}

// ── 模板中心：美颜 + 风格模板 ─────────────────────────────────────────────────
function tpl(
  id: string,
  name: string,
  category: AiAvatarTemplate["category"],
  description: string,
  capability: AiAvatarTemplate["capability"],
  usageCount: number,
): AiAvatarTemplate {
  return {
    id,
    name,
    category,
    description,
    thumbnailUrl: null,
    params: null,
    capability,
    official: true,
    ownerUserId: null,
    enabled: true,
    usageCount,
    createdAt: t(40),
    updatedAt: t(3),
  };
}

function buildTemplates(): AiAvatarTemplate[] {
  return [
    tpl("b1", "主播美颜", "beauty", "通用磨皮 + 提亮，适合带货直播", "restore", 1280),
    tpl("b2", "高清质感", "retouch", "GFPGAN 高清修复 + 锐化", "restore", 940),
    tpl("b3", "冷白皮", "beauty", "肤色映射偏冷白", "restore", 760),
    tpl("b4", "复古滤镜", "beauty", "暖色调 + 颗粒", "restore", 410),
    tpl("b5", "奶油雾面", "beauty", "低对比柔光", "restore", 360),
    tpl("b6", "通透裸妆", "beauty", "轻妆容迁移", "makeup", 520),
    tpl("st-anchor", "写实主播风", "style", "高清写实 · 适合带货直播", "txt2img", 880),
    tpl("st-lux", "轻奢风", "style", "质感妆容 · 时尚气质", "txt2img", 430),
    tpl("st-min", "简约风", "style", "干净通勤 · 职业感", "txt2img", 390),
    tpl("st-guo", "国风", "style", "东方韵味 · 古典妆造", "txt2img", 350),
    tpl("st-2d", "二次元", "style", "动漫渲染 · 大眼立体", "txt2img", 610),
    tpl("st-sci", "科幻", "style", "未来感 · 金属机能", "txt2img", 280),
  ];
}
