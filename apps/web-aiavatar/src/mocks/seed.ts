import type { AiAvatarAsset, AiAvatar, AiAvatarVersion } from "@ai-star-eco/types/ai-avatar";

// 占位图 data-uri（与 store.placeholderDataUri 同风格，独立避免循环依赖）
function ph(w: number, h: number, title: string, subtitle: string, badge: string, seed: number): string {
  const hue = 38;
  const cx = w / 2 + ((seed % 7) - 3) * (w * 0.01);
  const headR = Math.min(w, h) * 0.15;
  const headCy = h * 0.36;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><defs><pattern id='p${seed}' width='14' height='14' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'><line x1='0' y1='0' x2='0' y2='14' stroke='hsla(${hue},85%,55%,0.10)' stroke-width='2'/></pattern></defs><rect width='100%' height='100%' fill='#17171a'/><rect width='100%' height='100%' fill='url(#p${seed})'/><ellipse cx='${cx}' cy='${headCy + headR * 1.9}' rx='${headR * 2}' ry='${headR * 1.5}' fill='hsla(${hue},85%,55%,0.14)'/><circle cx='${cx}' cy='${headCy}' r='${headR}' fill='hsla(${hue},85%,55%,0.22)'/><rect x='12' y='${h - 70}' width='${w - 24}' height='58' rx='12' fill='rgba(0,0,0,0.45)' stroke='hsla(${hue},85%,55%,0.35)'/><text x='24' y='${h - 44}' fill='#f5f1e8' font-family='monospace' font-size='${Math.max(13, w / 18)}' font-weight='bold'>${esc(title)}</text><text x='24' y='${h - 24}' fill='hsl(${hue},85%,60%)' font-family='monospace' font-size='${Math.max(10, w / 30)}'>${esc(subtitle)}</text><rect x='${w - 72}' y='12' width='58' height='20' rx='10' fill='hsl(${hue},85%,55%)'/><text x='${w - 62}' y='26' fill='#17171a' font-family='monospace' font-size='11' font-weight='bold'>${esc(badge)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const t = (daysAgo: number) => new Date(Date.now() - daysAgo * 864e5).toISOString();

/**
 * 默认 seed 人脸：优先使用 public/samples/real-*.jpeg 的真实照片，保留 face-{3..4}.svg 作为补位。
 * 让总库 / 打样 / 出图显示真实结构的脸，精调工作台的 MediaPipe 关键点检测能真的命中。
 * 想用自己的照片：新建「真人授权复刻」→ 上传照片（mock 会读真实字节，全流程用你的图），
 * 或把 public/samples/real-*.jpeg 换成你的图（保持同名）。
 */
export const SAMPLE_FACES = ["/samples/real-male.jpeg", "/samples/real-female.jpeg", "/samples/face-3.svg", "/samples/face-4.svg"];
export function sampleFace(seed: number): string {
  return SAMPLE_FACES[((seed % SAMPLE_FACES.length) + SAMPLE_FACES.length) % SAMPLE_FACES.length];
}

/** 3 个种子AiAvatar，覆盖不同状态，让总库一进来就有内容（封面用可检测的真实结构人脸）。 */
export const SEED_AVATARS: AiAvatar[] = [
  {
    id: "aiavatar-seed-luna", ownerUserId: "mock-user", name: "星瞳 Luna", mode: "ai_original",
    status: "finalized_2d", persona: "清新自然的虚拟偶像，亲和笑容，适合商业代言与内容连载",
    styleCategory: "甜美日常", coverAssetId: "aiavatar-seed-luna-cover",
    coverUrl: sampleFace(1), // real-female.jpeg
    currentVersionId: "aiavatar-seed-luna-v2", finalizedVersionId: "aiavatar-seed-luna-v2",
    has3d: false, hasVideo: false, tags: ["甜美", "笑容", "商业"], createdAt: t(9), updatedAt: t(1),
  },
  {
    id: "aiavatar-seed-yan", ownerUserId: "mock-user", name: "墨砚", mode: "real_clone",
    status: "refining", persona: "清爽干练的真人复刻形象，辨识度高", styleCategory: "都市商务",
    coverAssetId: "aiavatar-seed-yan-cover", coverUrl: sampleFace(0), // real-male.jpeg
    currentVersionId: "aiavatar-seed-yan-v1", has3d: false, hasVideo: false,
    tags: ["复刻", "都市"], createdAt: t(5), updatedAt: t(2),
  },
  {
    id: "aiavatar-seed-nova", ownerUserId: "mock-user", name: "Nova", mode: "ai_original",
    status: "archived", persona: "利落中性风人设", styleCategory: "未来机能",
    coverAssetId: "aiavatar-seed-nova-cover", coverUrl: sampleFace(2), // face-3 男·利落
    currentVersionId: "aiavatar-seed-nova-v1", finalizedVersionId: "aiavatar-seed-nova-v1",
    has3d: true, hasVideo: true, tags: ["未来感", "已归档"], createdAt: t(20), updatedAt: t(12),
    archivedAt: t(12),
  },
];

export function seedVersionsFor(a: AiAvatar): AiAvatarVersion[] {
  if (a.id === "aiavatar-seed-luna") {
    return [
      ver(a.id, "aiavatar-seed-luna-v1", 1, "打样", "AI 原创打样", t(9), ["aiavatar-seed-luna-d1"], sampleFace(1)),
      ver(a.id, "aiavatar-seed-luna-v2", 2, "模板美化出图", "美颜/质感", t(1), ["aiavatar-seed-luna-cover"], sampleFace(1), true),
    ];
  }
  if (a.id === "aiavatar-seed-yan") {
    return [ver(a.id, "aiavatar-seed-yan-v1", 1, "真人复刻打样", "真人复刻打样", t(5), ["aiavatar-seed-yan-cover"], sampleFace(0))];
  }
  if (a.id === "aiavatar-seed-nova") {
    return [ver(a.id, "aiavatar-seed-nova-v1", 1, "定稿版", "美颜/质感", t(20), ["aiavatar-seed-nova-cover"], sampleFace(2), true)];
  }
  return [];
}

export function seedAssetsFor(a: AiAvatar, versions: AiAvatarVersion[]): AiAvatarAsset[] {
  const out: AiAvatarAsset[] = [];
  if (a.id === "aiavatar-seed-luna") {
    out.push(asset("aiavatar-seed-luna-cover", a.id, "aiavatar-seed-luna-v2", "image_2d", sampleFace(1), "half_body"));
    out.push(asset("aiavatar-seed-luna-d1", a.id, "aiavatar-seed-luna-v1", "draft_image", sampleFace(1)));
    out.push(asset("aiavatar-seed-luna-d2", a.id, "aiavatar-seed-luna-v1", "draft_image", sampleFace(3)));
  }
  if (a.id === "aiavatar-seed-yan") {
    out.push(asset("aiavatar-seed-yan-cover", a.id, "aiavatar-seed-yan-v1", "image_2d", sampleFace(0), "half_body"));
  }
  if (a.id === "aiavatar-seed-nova") {
    out.push(asset("aiavatar-seed-nova-cover", a.id, "aiavatar-seed-nova-v1", "image_2d", sampleFace(2), "half_body"));
    out.push({
      id: "aiavatar-seed-nova-3d", avatarId: a.id, versionId: "aiavatar-seed-nova-v1", kind: "model_3d",
      fileUrl: "#mock-glb", thumbnailUrl: ph(384, 384, "3D MODEL", "GLB · 可旋转", "MOCK", 6),
      mimeType: "model/gltf-binary", width: 0, height: 0, fileSize: 932, durationSec: 0, format3d: "GLB",
      engine: "MOCK", providerMode: "mock", encrypted: false, meta: { interactive: true }, createdAt: t(13),
    });
    out.push({
      id: "aiavatar-seed-nova-video", avatarId: a.id, versionId: "aiavatar-seed-nova-v1", kind: "video",
      fileUrl: ph(405, 720, "VIDEO 10s", "缓慢运镜", "MOCK", 6), thumbnailUrl: ph(405, 720, "VIDEO 10s", "运镜", "MOCK", 6),
      mimeType: "image/png", width: 405, height: 720, fileSize: 0, durationSec: 10,
      engine: "MOCK", providerMode: "mock", encrypted: false, meta: { effect: "ken_burns", posterOnly: true }, createdAt: t(13),
    });
  }
  return out;
}

function ver(avatarId: string, id: string, no: number, label: string, note: string, createdAt: string,
             assetIds: string[], previewUrl: string, preferred = false): AiAvatarVersion {
  return {
    id, avatarId, versionNo: no, label, note, author: "mock-user", sourceStatus: null, params: null,
    previewAssetId: assetIds[0], previewUrl, assetIds, jobId: null, preferred, discarded: false, createdAt,
  };
}

function asset(id: string, avatarId: string, versionId: string, kind: AiAvatarAsset["kind"], url: string,
               shot?: AiAvatarAsset["standardShot"]): AiAvatarAsset {
  const dims = imageDimensions(url);
  return {
    id, avatarId, versionId, kind, standardShot: shot ?? null, fileUrl: url, thumbnailUrl: url,
    mimeType: imageMime(url), width: dims.width, height: dims.height, fileSize: 0, durationSec: 0,
    engine: "MOCK", providerMode: "mock", encrypted: false, createdAt: "2026-05-29T00:00:00Z",
  };
}

function imageMime(url: string): string {
  if (/\.jpe?g($|\?)/i.test(url) || url.startsWith("data:image/jpeg")) return "image/jpeg";
  if (/\.svg($|\?)/i.test(url) || url.startsWith("data:image/svg+xml")) return "image/svg+xml";
  return "image/png";
}

function imageDimensions(url: string): { width: number; height: number } {
  if (url.includes("real-male.jpeg")) return { width: 225, height: 225 };
  if (url.includes("real-female.jpeg")) return { width: 168, height: 300 };
  return { width: 384, height: 512 };
}
