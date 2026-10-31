import { fireEvent, screen, within } from "@testing-library/react";

/** 换场景：点场景名 →「全部场景」→ 在边栏里点那个场景（和用户的路径一样）。 */
export function pickScene(title: string) {
  fireEvent.click(screen.getByRole("button", { name: /^换场景，当前/ }));
  fireEvent.click(screen.getByRole("button", { name: "全部场景" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: /^AI (视频|图片)场景$/ })).getByRole("button", { name: title }));
}

/** 场景的选项组在「视频规格 / 图片设置」面板里：没打开就先打开。 */
export function optionGroup(label: string) {
  if (!screen.queryByRole("group", { name: label })) openSpec();
  return screen.getByRole("group", { name: label });
}

/** 打开「视频规格 / 图片设置」面板（已经开着就不动）。 */
export function openSpec() {
  const toggle = screen.getByRole("button", { name: /^(视频规格|图片设置)：/ });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
}

/** 拖时长滑块（在规格面板里）。 */
export function setDuration(seconds: number) {
  openSpec();
  fireEvent.change(screen.getByLabelText(/^时长/), { target: { value: String(seconds) } });
}

/** 空着的参考图位：先点「添加…」，再选「上传…」。 */
export async function chooseUpload(label: string) {
  fireEvent.click(await screen.findByRole("button", { name: `添加${label}` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: `上传${label}` }));
}

/** 打开「最近」弹层。 */
export async function openRecent() {
  fireEvent.click(await screen.findByRole("button", { name: "最近" }));
  return within(await screen.findByRole("dialog", { name: "最近的草稿" }));
}
