// 演示模式（USE_MOCK=1）的场景目录：照服务端 GET /v1/ip-studio/scenes 的形状挑几条，拼话也只做演示用的最小版本。
// 真目录在 apps/server/src/main/resources/ipstudio/scenes.json，改场景改那里。
import type { StudioSceneCatalog, StudioSceneComposeRequest, StudioSceneComposed } from "@ai-star-eco/types";

export const MOCK_SCENES: StudioSceneCatalog = {
  version: 1,
  imageGroups: [{ id: "ip", title: "IP 形象" }, { id: "person", title: "人物" }, { id: "product", title: "商品" }],
  videoGroups: [{ id: "commerce", title: "电商带货" }, { id: "ip", title: "IP 内容" }],
  image: [
    { id: "free", group: "ip", title: "自由出图", description: "自己写描述，可以放几张参考图", refs: [1, 2, 3, 4].map(n => ({ label: `参考图 ${n}`, required: false })), prompt: "", hint: "说说想要什么画面", ratio: "3:4" },
    { id: "face-turnaround", group: "person", title: "脸部三视图", description: "正脸、半侧脸、侧脸，做角色参考", refs: [{ label: "人物照片", required: true }], prompt: "以图1人物为准，生成纯白背景的头部三视图。", hint: "可以补充气质、表情或写实程度", ratio: "16:9" },
    { id: "white-background", group: "product", title: "商品白底图", description: "干净的白底主图，平台上架直接用", refs: [{ label: "商品图", required: true }], prompt: "把图1中的商品单独放到纯白背景正中。", hint: "可以补充角度和摆放", ratio: "1:1" },
  ],
  video: [
    { id: "ecom-talking", group: "commerce", title: "口播带货", description: "有人出镜推荐，建立购买信任", images: { label: "商品图", required: true, max: 4 }, video: null, character: true, voice: true,
      placeholder: "说说卖什么、想突出哪一点", textRequired: false, durations: [15, 25, 30, 45], duration: 25, ratio: "9:16",
      structure: "真人对着镜头讲：开头一句话说清商品能解决什么，中间展示商品，结尾引导下单。", ideas: ["开头用一个反常识的说法抓人"], skill: "video-generation" },
    { id: "recreation", group: "ip", title: "爆款复刻", description: "参考一条爆款，做你自己的版本", images: { label: "替换素材", required: false, max: 4 }, video: { label: "参考视频", required: true }, character: false, voice: false,
      placeholder: "说说要换成什么", textRequired: true, durations: [15, 25], duration: 25, ratio: "9:16",
      structure: "先拆解参考视频，再按同样的结构换成我的内容。", ideas: ["保留原片的节奏"], skill: "reference-video-recreation" },
  ],
};

export function mockCompose(r: StudioSceneComposeRequest): StudioSceneComposed {
  if (r.kind === "image") {
    const scene = MOCK_SCENES.image.find(s => s.id === r.sceneId);
    const extra = r.text?.trim() || "";
    if (r.sceneId === "free") return { text: extra };
    return { text: (r.custom?.trim() || scene?.prompt || "") + (extra ? `\n补充要求：${extra}` : "") };
  }
  const scene = MOCK_SCENES.video.find(s => s.id === r.sceneId);
  return { text: `（演示）帮我做一条 ${r.duration ?? scene?.duration} 秒的短视频，类型是「${scene?.title}」。${r.text ? `\n我的要求：${r.text}` : ""}`, skillKey: scene?.skill };
}
