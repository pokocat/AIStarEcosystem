// The frame question for places that have no Studio panel controls to switch modes (the vendored node panel):
// generate from the text anyway, or go back and connect pictures. Closing the dialog counts as going back.
// Words and target mode come from the same rule as the Studio panel (studio-video-prompt).
import { createElement } from "react";
import type { ModalFuncProps } from "antd";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { studioFrameIntentCopy, type StudioFrameIntent } from "./studio-video-prompt";

type ConfirmModal = { confirm: (props: ModalFuncProps) => unknown };

export function confirmStudioFrames(modal: ConfirmModal, intent: StudioFrameIntent, model: VideoStudioModel, canvasImages: number): Promise<boolean> {
  const copy = studioFrameIntentCopy(intent, model.contract.modes, canvasImages);
  return new Promise(resolve => {
    modal.confirm({
      title: copy.title,
      content: createElement("div", null, copy.lines.map(line => createElement("p", { key: line }, line))),
      okText: "仍按文字生成", cancelText: "先去连图片",
      onOk: () => resolve(true), onCancel: () => resolve(false),
    });
  });
}
