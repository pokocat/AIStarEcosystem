// All 30 positive prompts and both negative lists are preserved verbatim from the uploaded matrix.
import matrix from "./personal-ip-prompt-matrix.json";

export type IpPictureType = "turnaround" | "sheet" | "scene" | "avatar" | "actions";
export const IP_PICTURE_TYPES: { value: IpPictureType; label: string; ratio: string; layout: string }[] = [
  { value: "turnaround", label: "标准三视图", ratio: "16:9", layout: "正面、侧面、背面横向三栏，全身等高，纯白背景。" },
  { value: "sheet", label: "IP 全视角图鉴", ratio: "3:4", layout: "上方为全身主视觉，下方横排面部、侧颜、发型、服饰四张方形细节图。" },
  { value: "scene", label: "场景化全身主视觉", ratio: "9:16", layout: "完整全身构图，搭配风格场景，背景虚化突出人物。" },
  { value: "avatar", label: "胸像头像特写", ratio: "1:1", layout: "胸部以上居中构图，聚焦面部，极简背景。" },
  { value: "actions", label: "多动作延展图", ratio: "16:9", layout: "三个全身动作横向排列，同一人物、穿搭与比例，纯白背景。" },
];
type IpStyle = { value: string; label: string; prompts: Record<IpPictureType, string> };
export const IP_PROMPT_STYLES: IpStyle[] = matrix.styles;
export const IP_NEGATIVE_PROMPTS = matrix.negativePrompts;
export function ipPromptSelection(options: Record<string, string>) {
  const style = IP_PROMPT_STYLES.find(s => s.value === options.style) || IP_PROMPT_STYLES[0];
  const picture = IP_PICTURE_TYPES.find(p => p.value === options.output) || IP_PICTURE_TYPES[1];
  const ratio = picture.value === "scene" && options.sceneRatio === "16:9" ? "16:9" : picture.ratio;
  return { style, picture, ratio };
}
/** Keep the uploaded body intact; only an explicit landscape scene choice changes its ratio. */
export function composePersonalIpPrompt(photos: string[], options: Record<string, string>) {
  const { style, picture, ratio } = ipPromptSelection(options);
  const body = picture.value === "scene" && ratio === "16:9"
    ? style.prompts.scene.replace("9:16竖版", "16:9横版") : style.prompts[picture.value];
  const negative = IP_NEGATIVE_PROMPTS[["business", "chinese", "forest"].includes(style.value) ? "realistic" : "stylized"];
  return [
    `用${photos.length ? ` ${photos.map(title => `@${title}`).join("、")} ` : "我的照片"}制作个人 IP，出一张${picture.label}。画幅比例：${ratio}。风格：${style.label}。`,
    body,
    `避免出现：${negative}`,
  ].join("\n\n");
}
