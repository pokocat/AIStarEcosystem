// 音频生成 —— 本仓的 AI IP 工作台还没开这条链。
//
// §8.0：宁可明确报错，也不能拿一段静音或占位音频冒充成功。
// 要开的时候在这里调服务端（同 generation.ts 的形态）。

import type { UploadedFile } from "./file-storage";

export async function requestAudioGeneration(..._args: unknown[]): Promise<Blob> {
  throw new Error("语音生成还没开通");
}

export async function storeGeneratedAudio(..._args: unknown[]): Promise<UploadedFile> {
  throw new Error("语音生成还没开通");
}
