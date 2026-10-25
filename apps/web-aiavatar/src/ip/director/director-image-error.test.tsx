// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DirectorAssets } from "./director-assets";

vi.mock("../api", () => ({ DirectorApi: { runTask: vi.fn(), edit: vi.fn() }, IpStudioApi: {} }));
vi.mock("../studio-errors", () => ({ useStudioApp: () => ({ modal: { confirm: vi.fn() } }) }));
afterEach(cleanup);

test("asset grid exposes the persisted provider reason without opening asset details", () => {
  const reason = "图片未通过生成服务的内容审核：参考图可能涉及未成年人形象限制";
  const slot = { candidates: [], adoptedId: null, adoptedBy: null, error: { message: reason, at: "2026-10-25T08:22:39Z" } };
  const work: any = { id: "error-test", episodes: [{ id: "ep1", no: 1 }], tasks: [], pricing: { image: 30, textMax: 21, mock: false },
    assets: [{ id: "as9", kind: "character", name: "如花", description: "成年角色", aliases: [], episodeIds: ["ep1"], image: slot }] };
  const props: any = { work, episodeId: "ep1", apply: vi.fn(), setError: vi.fn() };
  const { rerender } = render(<DirectorAssets {...props}/>);
  expect(screen.getByRole("alert").textContent).toBe(reason);
  rerender(<DirectorAssets {...props} work={{ ...work, assets: [{ ...work.assets[0], image: { ...slot, error: null } }] }}/>);
  expect(screen.queryByRole("alert")).toBeNull();
});
