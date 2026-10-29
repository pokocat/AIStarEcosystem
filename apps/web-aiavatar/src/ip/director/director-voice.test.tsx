// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { DirectorAsset, DirectorWork } from "@ai-star-eco/types";
import { VoiceDialog } from "./director-voice";
import { DirectorApi } from "../api";

vi.mock("../api", () => ({ DirectorApi: { edit: vi.fn(), uploadAudio: vi.fn() } }));
vi.mock("@/canvas-bridge/studio-api", () => ({ studioVoiceProfiles: vi.fn() }));

const character = { id: "a1", kind: "character", name: "本人", rev: 4, voice: null, voiceDesc: "旧描述" } as DirectorAsset;
function work(asset = character) { return { id: "w1", assets: [asset] } as DirectorWork; }
function Host({ close }: { close: () => void }) {
  const [current, setCurrent] = useState(work());
  return <VoiceDialog work={current} asset={current.assets[0]} apply={setCurrent} onClose={close}/>;
}
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

test("binding failure keeps the uploaded sample and the saved description for a successful retry", async () => {
  const close = vi.fn();
  const descriptionSaved = work({ ...character, rev: 5, voiceDesc: "清晰自然" });
  const bound = work({ ...descriptionSaved.assets[0], rev: 6, voice: { key: "owned/voice.wav", name: "本人声音", source: "upload", durationSec: 5, voiceId: null, at: "2026-10-29T00:00:00Z" } });
  vi.mocked(DirectorApi.uploadAudio).mockResolvedValue({ key: "owned/voice.wav", url: null, fileName: "本人声音.wav", durationSec: 5 });
  vi.mocked(DirectorApi.edit).mockResolvedValueOnce(descriptionSaved).mockRejectedValueOnce(new Error("声音参考上传失败"))
    .mockResolvedValueOnce(bound);
  const { container } = render(<Host close={close}/>);
  fireEvent.change(screen.getByRole("textbox", { name: /音色描述/ }), { target: { value: "清晰自然" } });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["sample"], "本人声音.wav", { type: "audio/wav" })] } });
  fireEvent.click(screen.getByRole("button", { name: "保存音色" }));
  await screen.findByText("声音参考上传失败");
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "保存音色" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(DirectorApi.uploadAudio).toHaveBeenCalledOnce();
  expect(DirectorApi.edit).toHaveBeenCalledTimes(3);
  expect(vi.mocked(DirectorApi.edit).mock.calls.map(c => c[1])).toEqual(["asset.update", "asset.setVoice", "asset.setVoice"]);
  expect(vi.mocked(DirectorApi.edit).mock.calls[2][4]).toMatchObject({ key: "owned/voice.wav", durationSec: 5 });
});

test("a failed upload stays open and never binds a missing sample", async () => {
  const close = vi.fn();
  vi.mocked(DirectorApi.uploadAudio).mockRejectedValue(new Error("角色声音需要 2–15 秒，请剪短或换一段音频"));
  const { container } = render(<Host close={close}/>);
  expect(screen.getByText(/2–15 秒、最多 15 MB/)).toBeDefined();
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["sample"], "声音.wav")] } });
  fireEvent.click(screen.getByRole("button", { name: "保存音色" }));
  await screen.findByText("角色声音需要 2–15 秒，请剪短或换一段音频");
  expect(DirectorApi.edit).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
