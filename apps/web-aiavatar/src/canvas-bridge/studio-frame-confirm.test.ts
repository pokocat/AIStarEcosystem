// @vitest-environment node
import { expect, test, vi } from "vitest";
import type { ModalFuncProps } from "antd";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { confirmStudioFrames } from "./studio-frame-confirm";

const model = { contract: { modes: [{ mode: "t2v" }, { mode: "i2v", label: "首帧", needsFirstFrame: true },
  { mode: "first_last_frame_video", label: "首尾帧", needsFirstFrame: true, needsLastFrame: true }] } } as unknown as VideoStudioModel;
const intent = { mentions: ["图1", "图2", "首帧", "尾帧"], pictures: 2, first: true, last: true, needed: 2, bound: 0, hasFirst: false, lastFrameIgnored: false };

test("the node panel's frame question: only 「仍按文字生成」 submits; going back or closing does not", async () => {
  const calls: ModalFuncProps[] = [];
  const modal = { confirm: vi.fn((props: ModalFuncProps) => { calls.push(props); }) };
  const text = confirmStudioFrames(modal, intent, model, 2);
  expect(calls[0].title).toBe("描述里提到了图片，这次没有用上图片");
  expect(calls[0].okText).toBe("仍按文字生成");
  expect(JSON.stringify(calls[0].content)).toContain("改用「首尾帧」");
  void calls[0].onOk?.();
  await expect(text).resolves.toBe(true);
  const back = confirmStudioFrames(modal, intent, model, 2);
  void calls[1].onCancel?.();
  await expect(back).resolves.toBe(false);
});
