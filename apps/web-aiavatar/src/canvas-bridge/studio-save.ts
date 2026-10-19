type Save = () => Promise<string>;
let active: { projectId: string; save: Save } | null = null;
export function registerStudioSave(projectId: string, save: Save) {
  const handle = { projectId, save }; active = handle;
  return () => { if (active === handle) active = null; };
}
export async function saveStudioDocument(projectId: string) {
  // Let the canvas layout effect project the latest React nodes into its memory store.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (!active || active.projectId !== projectId) throw new Error("画布尚未打开，请稍后重试");
  const result = await active.save();
  // 冲突带上错误码：顶栏的冲突弹窗已经在说这件事了，通知层据此**不再弹**（见 studio-errors.tsx）。
  // 以前每一条经过这里的保存（助手面板的自动保存、任务轮询回写…）都弹同一句话，
  // 用户看到的就是「页面一直在报错」。
  if (result === "conflict") throw Object.assign(new Error("这张画布在别处被改过了，先处理顶栏里的保存冲突，再继续创作"), { code: "IP_PROJECT_STALE" });
  if (result !== "saved" && result !== "nothing-to-save") throw new Error("画布保存失败，请先重试保存");
}
