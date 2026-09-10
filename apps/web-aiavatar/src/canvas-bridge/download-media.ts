// ─────────────────────────────────────────────────────────────────────────────
// 下载画布上的图 / 视频 / 音频，并且**按字节决定后缀**。
//
// 用户实测报的：下载下来是 `.png`，电脑上看不了预览，改名 `.jpg` 才能看。
// 两个原因叠在一起：
//
//   ① 上游的 `imageExtension()` 是给 **data URL** 写的
//      （`^data:image/([^;]+)`），而我们的 `metadata.content` 是**签名 OSS 地址**
//      （`https://…/abc123.jpg?Expires=…`）。两条正则都不命中 → 一律回落 `"png"`。
//      线上那条示例里 16 个素材键有 14 个其实是 `.jpg`。
//
//   ② 就算名字取对了也未必生效：`saveAs(跨域URL, name)` 时浏览器会**忽略**
//      `a[download]`，用地址里的文件名。所以要先把内容取回来变成 blob（同源），
//      名字才作数。
//
// 顺带把 §8.0.1 ⑤ 的第三处补上：v0.184 修了「落库」和「转交给厂商」两处都按字节判，
// 唯独下载这条路还在按文件名/猜。
//
// ⚠️ **但字节嗅探目前在生产上跑不到** —— OSS 桶没配 CORS，浏览器 `fetch()` 直接被拦
// （实测：在 https://aiavatar.aibuzz.cn 上 fetch 那个公开对象 → `TypeError: Failed to fetch`；
// 响应头里没有任何 `access-control-*`）。所以真实路径是走下面的 catch 兜底：
// 用 **storageKey 的后缀**取名 —— 服务端 v0.184 起按字节改正过 key，所以它是对的，
// 用户报的「下下来是 .png 打不开」就此解决。
// 等 OSS 配上 CORS（见 TODO），嗅探这条会自动生效，名字也才真的由我们说了算
// （跨域时浏览器忽略 `a[download]`，现在文件名用的是 OSS 对象名）。
// 本机 dev 的 `aep.cdn.driver=local` 走同源 `/cdn/...`，嗅探是通的。
// ─────────────────────────────────────────────────────────────────────────────

import { saveAs } from "file-saver";

import { fetchAssetBlob } from "./api";

/** 文件头 → 扩展名。与服务端 `ImageBytes.sniff` 同一套判断，认不出返回 null（不猜）。 */
export function sniffExtension(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return "bmp";
  // ftyp box：MP4 / MOV 一族
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "mp4";
  if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "mp3";   // ID3
  if (b.length >= 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "ogg";
  return null;
}

/** MIME → 扩展名。嗅探认不出时的第二顺位（音频格式头太杂，主要靠这个）。 */
function extFromMime(mime?: string | null): string | null {
  if (!mime) return null;
  const m = mime.toLowerCase().split(";")[0]!.trim();
  const map: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp",
    "image/gif": "gif", "image/bmp": "bmp",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
    "audio/aac": "aac", "audio/flac": "flac", "audio/opus": "opus", "audio/ogg": "ogg",
  };
  return map[m] ?? null;
}

/** 地址 / storageKey 里的后缀（去掉查询串）。 */
export function extFromUrl(url: string): string | null {
  const path = url.split(/[?#]/)[0] ?? "";
  const m = path.match(/\.([A-Za-z0-9]{2,5})$/);
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * 取回内容、按真实字节定后缀、存到本地。
 *
 * `baseName` 不带后缀。取不回内容（跨域被拦、签名过期）就退回直接用地址下载 ——
 * 那时名字可能由浏览器决定，但至少东西能拿到，比什么都不做强。
 */
export async function blobExtension(blob: Blob, declaredMime?: string | null, url?: string): Promise<string | null> {
  try {
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const sniffed = sniffExtension(head);
    if (sniffed) return sniffed;
  } catch {
    /* 读不到头就往下走 */
  }
  return extFromMime(blob.type || declaredMime) ?? (url ? extFromUrl(url) : null);
}

export async function downloadMedia(
  url: string,
  baseName: string,
  declaredMime?: string | null,
  storageKey?: string | null,
): Promise<void> {
  try {
    // 有 storageKey 就走同源路由 —— 桶没配 CORS，直接 fetch 那个签名地址必被拦。
    // 同源之后：字节嗅探真的跑得到，`a[download]` 也才作数。
    const blob = storageKey ? await fetchAssetBlob(storageKey) : await directBlob(url);
    saveAs(blob, `${baseName}.${(await blobExtension(blob, declaredMime, storageKey ?? url)) ?? "bin"}`);
  } catch {
    // 兜底：直接交给浏览器。名字未必作数（跨域时 a[download] 被忽略），但不至于下不下来
    // 路径优先于 declaredMime：文档里的 `metadata.mimeType` 是画布自己写死的
    // （实测线上数据里 key 是 `.jpg` 而 mimeType 写着 `image/png`），
    // 而 key 的后缀是服务端按字节改正过的（v0.184），可信得多。
    saveAs(url, `${baseName}.${extFromUrl(storageKey ?? url) ?? extFromMime(declaredMime) ?? "bin"}`);
  }
}

async function directBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

/** storageKey 的后缀 → MIME。服务端 v0.184 起按字节改正过 key，所以它比画布自己记的可信。 */
export function mimeFromKey(key: string | null | undefined): string | undefined {
  const ext = key ? extFromUrl(key) : null;
  if (!ext) return undefined;
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    gif: "image/gif", bmp: "image/bmp",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
    mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac", flac: "audio/flac",
    opus: "audio/opus", ogg: "audio/ogg",
  };
  return map[ext];
}
