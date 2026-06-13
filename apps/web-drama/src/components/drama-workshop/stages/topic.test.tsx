import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TopicStage } from "./topic";
import type { ProjectData } from "@/mocks/drama-workshop";
import type { WorkshopState } from "../workbench";

// 回归：一句话点子立项的新项目 topicCards 为空、mainline 为空。
// 旧实现 `top.title`（top=undefined）会运行时崩溃；这里锁住「不崩溃 + 标题回退 projectInfo」。
const freshData: ProjectData = {
  projectInfo: {
    title: "齐天大圣闯好莱坞",
    type: "通用 / 自定义",
    episodes: 12,
    duration: "每集 ~75 秒",
    ratio: "9:16",
    logline: "孙悟空大闹好莱坞星光大道",
    mainline: "",
  },
  topicCards: [],
  episodes: [],
  characters: [],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
};

describe("TopicStage", () => {
  it("空 topicCards 的一句话立项项目不崩溃，标题回退 projectInfo", () => {
    const { container } = render(
      <TopicStage data={freshData} state={{} as WorkshopState} dispatch={() => {}} />,
    );
    expect(container.textContent).toContain("齐天大圣闯好莱坞");
    expect(container.textContent).toContain("孙悟空大闹好莱坞星光大道");
  });
});
