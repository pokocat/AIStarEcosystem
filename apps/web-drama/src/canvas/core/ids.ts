// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/ids.ts —— 画布文档里各种 id 与请求幂等键的生成（v0.198）。
//
// id 只用 [A-Za-z0-9_-]：片段文本里的引用标记 `@[名字](look:<id>)` 用的正则只认这些字符
// （见 drama-canvas.ts CanvasSegment 注释），用了别的字符，引用就解析不出来。
// ─────────────────────────────────────────────────────────────────────────────

/** 文档里各类东西的 id 前缀（只为了看日志 / 文档时一眼认得出是什么）。 */
export const ID_PREFIX = {
  character: "ch",
  look: "lk",
  scene: "sc",
  material: "mt",
  segment: "sg",
  edge: "ed",
  history: "hv",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

/** id 合法字符（与引用正则一致）。 */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

function randomPart(len: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(len);
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
    return out;
  }
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** 新 id：`lk_k3v9x2ab01`。 */
export function newId(kind: IdKind): string {
  return `${ID_PREFIX[kind]}_${randomPart(10)}`;
}

/**
 * 由运行记录派生的确定性 id（合并结果时用）：同一次运行合两次得到同一个 id，合并才幂等。
 * 运行 id 里若有引用正则不认的字符，换成 `_`；总长截到 64。
 */
export function derivedId(kind: IdKind, runId: string, ...parts: (string | number)[]): string {
  const safeRun = runId.replace(/[^A-Za-z0-9_-]/g, "_");
  const tail = parts.length ? `-${parts.join("-")}` : "";
  const id = `${ID_PREFIX[kind]}-${safeRun}${tail}`;
  if (id.length <= 64) return id;
  // 太长：保留尾部（区分同一次运行里的第几个）+ 运行 id 的短哈希
  return `${ID_PREFIX[kind]}-${shortHash(safeRun)}${tail}`.slice(0, 64);
}

function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/**
 * 生成请求的幂等键（服务端按 owner + 键去重，同一个键重复请求回原运行记录、不重复扣费）。
 * 一次点击一个键；请求没收到回应时，重试沿用同一个（由 useCanvasRuns 管）。
 */
export function newClientRequestId(): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : randomPart(24);
  return `dcv-${Date.now().toString(36)}-${rand}`.slice(0, 64);
}
