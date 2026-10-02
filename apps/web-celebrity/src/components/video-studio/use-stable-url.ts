"use client";

import * as React from "react";

/**
 * 有任务在跑时列表每 5 秒刷新一次，而服务端每次都给一个**重新签名**的新地址。播放器、缩略图要是跟着换，
 * 就会从头重新加载：正在看的成片每 5 秒被打断一次，整张列表的图也每 5 秒重下一遍。
 * 所以手上的地址能用就一直用，只有它**加载失败之后**才换成服务端给的新地址。
 * （生成记录与模板卡片共用这一份：模板封面、原作成片、素材缩略图同理。）
 */
export function useStableUrl(url: string | null | undefined): [string | null, () => void] {
  const [src, setSrc] = React.useState<string | null>(url ?? null);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => {
    const next = url ?? null;
    if (next === null) return; // 暂时没给地址：先留着手上的
    if (src === null || (broken && next !== src)) {
      setSrc(next);
      setBroken(false);
    }
  }, [url, src, broken]);
  const markBroken = React.useCallback(() => setBroken(true), []);
  return [src, markBroken];
}
