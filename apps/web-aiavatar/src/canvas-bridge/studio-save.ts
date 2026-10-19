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
  if (result === "conflict") throw new Error("画布已有新的修改，请刷新后再创作");
  if (result !== "saved" && result !== "nothing-to-save") throw new Error("画布保存失败，请先重试保存");
}
