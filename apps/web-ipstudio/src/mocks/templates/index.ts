// ─────────────────────────────────────────────────────────────────────────────
// mocks/templates — 内置工作流模板（mock 模式用）。
//
// ⚠️ 这两个 JSON 是**服务端文件的逐字副本**，真源在：
//     apps/server/src/main/resources/ipstudio/templates/portrait-bjd-trio.json
//     apps/server/src/main/resources/ipstudio/templates/portrait-sticker-six.json
//
// 为什么复制而不是跨包 import：Next 的编译根是本 app 目录，从 apps/server 拉 JSON
// 会把后端资源目录卷进前端构建图。副本的代价是可能漂移，所以
// `src/lib/graph.test.ts` 里有一条测试直接读服务端那两个文件做逐字比对 ——
// 服务端改了模板、这里没同步，测试立刻红。改模板请改服务端那份，然后重新复制。
//
// 副本存在的意义：mock 模式必须和真后端跑同一张图。此前 mock 自己拼了一张
// 「每个出图节点都直连风格与特征卡」的图，于是 mock 能跑、真模板报「缺特征卡」——
// 输入闸门的缺陷被 mock 掩盖了整整一版。
// ─────────────────────────────────────────────────────────────────────────────

import type { IpTemplate } from "@ai-star-eco/types";
import bjdTrio from "./portrait-bjd-trio.json";
import stickerSix from "./portrait-sticker-six.json";

/** 服务端 `GET /v1/ip-studio/templates` 的等价物。 */
export const SERVER_TEMPLATES: IpTemplate[] = [
  bjdTrio as unknown as IpTemplate,
  stickerSix as unknown as IpTemplate,
];
