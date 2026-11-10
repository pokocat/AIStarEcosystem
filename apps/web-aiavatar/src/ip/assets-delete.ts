// 资产页的删除（2026-11-09）：图片 / 视频 / 音频和角色、场景、道具都能删一个或选几个一起删。
// 服务端只把资产库里的这一条标成已删除：文件不删，已用在画布和作品里的照常能用，自动收录也不会再把它加回来。
import type { useStudioApp } from './studio-errors';

type Modal = ReturnType<typeof useStudioApp>['modal'];
export type DeleteResult = { removed: string[]; error?: unknown };

/** 一个一个删；某个失败就停在那里，已经删掉的照样算删掉。 */
export async function deleteEach(ids: string[], remove: (id: string) => Promise<void>): Promise<DeleteResult> {
  const removed: string[] = [];
  for (const id of ids) {
    try { await remove(id); removed.push(id); }
    catch (error) { return { removed, error }; }
  }
  return { removed };
}

/** 先确认再删。title 给了就是删单个（写名字），否则写选中的个数。 */
export function confirmAssetDelete(modal: Modal, { ids, title, noun, remove, onDone }: {
  ids: string[]; title?: string; noun: string; remove: (id: string) => Promise<void>; onDone: (result: DeleteResult) => void;
}) {
  if (!ids.length) return;
  modal.confirm({
    title: title ? `删除「${title}」？` : `删除选中的 ${ids.length} 个${noun}？`,
    content: '已用在画布和作品中的不受影响，删除后也不会再自动加回资产库。',
    okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
    onOk: async () => onDone(await deleteEach(ids, remove)),
  });
}
