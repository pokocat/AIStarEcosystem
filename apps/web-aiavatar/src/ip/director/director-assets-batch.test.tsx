// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorAssets } from "./director-assets";

const api = vi.hoisted(() => ({ runTask: vi.fn(), edit: vi.fn() }));
const confirm = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ DirectorApi: api, IpStudioApi: {} }));
vi.mock("../studio-errors", async importOriginal => ({ ...(await importOriginal<typeof import("../studio-errors")>()), useStudioApp: () => ({ modal: { confirm } }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const slot = { candidates: [], adoptedId: null, adoptedBy: null, error: null };
const asset = (id: string, kind: string, name: string) => ({ id, kind, name, description: name, aliases: [], episodeIds: ["ep1"], image: slot });

// 2026-10-26 线上：作品的图片模型出不了方图，「生成全部参考图」里的三个道具被服务端在冻结前拒绝，
// 其余照常提交。批量要逐项提交，拒掉的那几项连同服务端原话一起说出来，不能整批停掉。
test("generate-all submits every asset and reports the props the server refused before charging", async () => {
  const sizeError = "作品设置里选的图片模型「GPT Image 2 4K」不能出 1:1 方图，道具参考图要用方图。请在作品设置里换一个能出方图的图片模型";
  const work: any = { id: "batch-work", episodes: [{ id: "ep1", no: 1 }], tasks: [], pricing: { image: 55, textMax: 21, mock: false },
    assets: [asset("c1", "character", "林夏"), asset("p1", "prop", "修复编号工作本"), asset("s1", "scene", "老宅"), asset("p2", "prop", "母亲旧毛衣")] };
  api.runTask.mockImplementation(async (_id: string, body: { targetId: string }) => {
    if (body.targetId.startsWith("p")) throw new ApiError({ code: "STUDIO_IMAGE_SIZE_UNSUPPORTED", message: sizeError }, 400);
    return work;
  });
  const apply = vi.fn(), setError = vi.fn();
  render(<DirectorAssets work={work} episodeId="ep1" apply={apply} setError={setError} {...({} as any)}/>);
  fireEvent.click(screen.getByRole("button", { name: /生成全部参考图/ }));
  const { onOk } = confirm.mock.calls[0][0];
  await act(async () => { await onOk(); });

  await waitFor(() => expect(api.runTask).toHaveBeenCalledTimes(4));
  expect(api.runTask.mock.calls.map(c => c[1].targetId)).toEqual(["c1", "s1", "p1", "p2"]);
  for (const [, body] of api.runTask.mock.calls) expect(body).toMatchObject({ type: "asset-image", maxCost: 55 });
  expect(apply).toHaveBeenCalledTimes(2);
  const message = setError.mock.calls.at(-1)![0] as string;
  expect(message).toMatch(/^2 项没有提交成功。/);
  expect(message).toContain(`修复编号工作本：${sizeError}`);
  expect(message).toContain("母亲旧毛衣：");
  expect(message).not.toMatch(/换一个画幅/);
});
