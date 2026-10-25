// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DirectorScriptFile } from "./director-script-file";
import { DirectorWorks } from "./director-works";
import { DirectorScript } from "./director-script";
import { clearDrafts } from "./director-shared";

const api = vi.hoisted(() => ({ importScript: vi.fn(), createWork: vi.fn(), patchWork: vi.fn(), listWorks: vi.fn(), push: vi.fn() }));
vi.mock("../api", () => ({ DirectorApi: api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => null }));
vi.mock("../studio-page", () => ({ StudioPage: ({ children, actions }: any) => <main>{actions}{children}</main> }));
vi.mock("../studio-gallery", () => ({ useStudioList: () => ({ data: [], loading: false }), GalleryState: () => null }));

beforeEach(() => { vi.clearAllMocks(); clearDrafts("file-test"); api.importScript.mockResolvedValue({ text: "第一场：夜市\n小鹿：回家吧。", format: "docx" }); });
afterEach(cleanup);
const upload = (name = "剧本.docx", content = "document") => fireEvent.change(screen.getByLabelText("上传剧本文件"), { target: { files: [new File([content], name)] } });

test("previews safely and only replaces existing editable text after explicit acceptance", async () => {
  function Host() {
    const [text, setText] = useState("原有正文");
    return <><DirectorScriptFile hasText={!!text} onImport={setText} onReadingChange={() => {}}/><textarea aria-label="正文" value={text} onChange={e => setText(e.target.value)}/></>;
  }
  render(<Host/>); upload();
  await screen.findByLabelText("文件文字预览");
  expect((screen.getByLabelText("正文") as HTMLTextAreaElement).value).toBe("原有正文");
  expect(api.createWork).not.toHaveBeenCalled(); expect(api.patchWork).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "关闭文件预览" }));
  expect((screen.getByLabelText("正文") as HTMLTextAreaElement).value).toBe("原有正文");
  upload(); await screen.findByLabelText("文件文字预览");
  fireEvent.click(screen.getByRole("button", { name: "替换当前正文" }));
  expect((screen.getByLabelText("正文") as HTMLTextAreaElement).value).toBe("第一场：夜市\n小鹿：回家吧。");
  expect(api.importScript).toHaveBeenCalledTimes(2);
});

test("unsupported, empty and oversized files never upload; parsing errors and excess text remain explicit", async () => {
  const imported = vi.fn();
  render(<DirectorScriptFile hasText={false} onImport={imported} onReadingChange={() => {}}/>);
  upload("binary.exe"); expect(screen.getByRole("alert").textContent).toContain("请选择");
  upload("empty.txt", ""); expect(screen.getByRole("alert").textContent).toContain("文件为空");
  const huge = new File(["text"], "huge.txt"); Object.defineProperty(huge, "size", { value: 8 * 1024 * 1024 + 1 });
  fireEvent.change(screen.getByLabelText("上传剧本文件"), { target: { files: [huge] } });
  expect(screen.getByRole("alert").textContent).toContain("8 MB"); expect(api.importScript).not.toHaveBeenCalled();
  api.importScript.mockRejectedValueOnce(new Error("扫描件请先识别文字")); upload("扫描.pdf");
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("扫描件"));
  api.importScript.mockResolvedValueOnce({ text: "字".repeat(60001), format: "txt" }); upload("长篇.txt");
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("未截断"));
  expect(imported).not.toHaveBeenCalled();
});

test("cancellation ignores a late response and allows another import", async () => {
  let resolve!: (v: any) => void;
  api.importScript.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const reading = vi.fn();
  render(<DirectorScriptFile hasText={false} onImport={() => {}} onReadingChange={reading}/>);
  upload(); fireEvent.click(screen.getByRole("button", { name: "取消读取" }));
  expect(api.importScript.mock.calls[0][1].aborted).toBe(true);
  resolve({ text: "过期返回", format: "docx" });
  upload("新的.txt"); await screen.findByLabelText("文件文字预览");
  expect((screen.getByLabelText("文件文字预览") as HTMLTextAreaElement).value).not.toBe("过期返回");
  expect(reading).toHaveBeenLastCalledWith(false);
});

test("new work imports a file, preserves it across tabs and submits the edited text", async () => {
  api.createWork.mockResolvedValue({ id: "DW-new" });
  render(<DirectorWorks/>);
  fireEvent.click(screen.getAllByRole("button", { name: "新建作品" })[0]);
  fireEvent.click(screen.getByRole("tab", { name: "导入剧本" })); upload();
  await screen.findByLabelText("文件文字预览");
  fireEvent.click(screen.getByRole("button", { name: "使用文件内容" }));
  fireEvent.click(screen.getByRole("tab", { name: "从创意开始" }));
  expect((screen.getByLabelText("创意") as HTMLTextAreaElement).value).toBe("");
  fireEvent.click(screen.getByRole("tab", { name: "导入剧本" }));
  expect((screen.getByLabelText("剧本正文") as HTMLTextAreaElement).value).toContain("小鹿");
  fireEvent.change(screen.getByLabelText("剧本正文"), { target: { value: "第一场：夜市\n修改后的对白" } });
  fireEvent.click(screen.getByRole("button", { name: "创建并继续" }));
  await waitFor(() => expect(api.createWork).toHaveBeenCalledWith({ title: undefined, script: "第一场：夜市\n修改后的对白" }));
  expect(api.push).toHaveBeenCalledWith("/director/DW-new");
});

test("workbench paste entry imports and saves through the existing revision guard", async () => {
  const work: any = { id: "file-test-work", idea: "", genre: "", tone: "", draft: "", draftRev: 7, tasks: [], episodes: [], settings: { style: "真人写实", aspectRatio: "9:16" }, pricing: { textMax: 21 } };
  const apply = vi.fn(); api.patchWork.mockResolvedValue({ ...work, draft: "第一场：夜市\n小鹿：回家吧。", draftRev: 8 });
  render(<DirectorScript work={work} apply={apply} setError={vi.fn()} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: "已有剧本？粘贴或上传" })); upload();
  await screen.findByLabelText("文件文字预览");
  fireEvent.click(screen.getByRole("button", { name: "使用文件内容" }));
  fireEvent.click(screen.getByRole("button", { name: "保存剧本" }));
  await waitFor(() => expect(api.patchWork).toHaveBeenCalledWith(work.id, { draft: "第一场：夜市\n小鹿：回家吧。", draftRev: 7 }));
  expect(apply).toHaveBeenCalledTimes(1);
});
