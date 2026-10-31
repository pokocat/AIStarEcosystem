import { act, fireEvent, screen, within } from "@testing-library/react";

/** 换场景：点场景名 →「全部场景」→ 在边栏里点那个场景（和用户的路径一样）。 */
export function pickScene(title: string) {
  fireEvent.click(screen.getByRole("button", { name: /^换场景，当前/ }));
  fireEvent.click(screen.getByRole("button", { name: "全部场景" }));
  const drawer = within(screen.getByRole("dialog", { name: /^AI (视频|图片)场景$/ }));
  fireEvent.click(drawer.getByText(title, { selector: "strong" }).closest("button")!);
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

/** 点素材位打开资产库（不给名字就点第一个空位）。 */
export async function openLibrary(label?: string) {
  const button = label ? await screen.findByRole("button", { name: new RegExp(`^(从资产库选|更换)${label}$`) })
    : (await screen.findAllByRole("button", { name: /^从资产库选/ }))[0];
  await act(async () => { fireEvent.click(button); });
}

/** 在资产库里点「用这个」（测试替身见 scene-test-picker.tsx）。 */
export async function confirmLibrary() {
  const use = await screen.findByRole("button", { name: "用这个" });
  await act(async () => { fireEvent.click(use); });
}

/** 从资产库选一份放进素材位：打开、选中、用这个。 */
export async function pickFromLibrary(label?: string) {
  await openLibrary(label);
  await confirmLibrary();
}

/** 打开「最近」弹层。 */
export async function openRecent() {
  fireEvent.click(await screen.findByRole("button", { name: "最近" }));
  return within(await screen.findByRole("dialog", { name: "最近的草稿" }));
}
