import { describe, expect, it } from "vitest";
import { seriesProgress, withEpisodeDoc, type ProjectData } from "./index";

// 多集短剧的完成度：每一集都合成了成片才算做完（评审 P2）。
// 以前合成任意一集就写 progress=100，服务端按 ≥100 发 done，一部 12 集只做完第 1 集的剧在列表里被当成片打开。
const base = (episodes: number): ProjectData => ({
  projectInfo: { title: "T", type: "悬疑", episodes, duration: "每集 75 秒", ratio: "9:16", logline: "", mainline: "" },
  topicCards: [],
  episodes: [],
  characters: [],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
  episodeDocs: {},
});
const assemble = (data: ProjectData, ep: number): ProjectData =>
  withEpisodeDoc(data, ep, { script: { ep, scenes: [] }, storyboard: { ep, scenes: [] }, assembled: { url: `/cdn/ep${ep}.mp4` } });

describe("seriesProgress", () => {
  it("12 集只合成了第 1 集：没到 100（不会被当成做完）", () => {
    const p = seriesProgress(assemble(base(12), 1));
    expect(p).toBeLessThan(100);
    expect(p).toBeGreaterThanOrEqual(50);
  });

  it("合成的集数越多进度越高，每一集都合成了才是 100", () => {
    let data = base(12);
    let last = seriesProgress(data);
    for (let ep = 1; ep <= 12; ep++) {
      data = assemble(data, ep);
      const p = seriesProgress(data);
      expect(p).toBeGreaterThan(last);
      expect(p === 100).toBe(ep === 12);
      last = p;
    }
  });

  it("单集作品合成了就是做完；集号超出总集数的成片不算；没有地址的成片不算", () => {
    expect(seriesProgress(assemble(base(1), 1))).toBe(100);
    expect(seriesProgress(assemble(assemble(base(2), 1), 3))).toBeLessThan(100);
    const blank = withEpisodeDoc(base(1), 1, { script: { ep: 1, scenes: [] }, storyboard: { ep: 1, scenes: [] }, assembled: { url: " " } });
    expect(seriesProgress(blank)).toBeLessThan(100);
  });
});
