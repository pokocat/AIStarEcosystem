const { CelebrityApi } = require("../../utils/api.js");
const { formatDuration } = require("../../utils/format.js");

let pollTimer = null;

Page({
  data: {
    statusBarHeight: 44,
    jobId: "",
    progress: 0,
    etaText: "—",
    frame: 8,
    steps: [
      { name: "脚本撰写", sub: "AI 正在打磨 4 个分镜的台词…", state: "done", time: "8s" },
      { name: "分镜画面生成", sub: "渲染 12 帧关键画面 · 当前 8/12", state: "current", time: "00:42" },
      { name: "AI 配音合成", sub: "等待中", state: "todo", time: "—" },
      { name: "视频合成与渲染", sub: "等待中", state: "todo", time: "—" }
    ]
  },

  onLoad(options) {
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
    this.setData({ jobId: (options && options.jobId) || "" });
    this.startPoll();
  },

  onUnload() {
    // 平台坑：必须在 onUnload 清 interval，否则内存泄漏 + 后台 setData 报警。详见 agent.md「网络」
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  },

  startPoll() {
    let pct = 12;
    pollTimer = setInterval(() => {
      pct = Math.min(100, pct + Math.floor(Math.random() * 6) + 2);
      const etaSec = Math.max(0, Math.round((100 - pct) * 1.8));
      const steps = this.data.steps.slice();
      if (pct >= 35) { steps[1].state = "done"; steps[1].time = "1:08"; steps[2].state = "current"; steps[2].sub = "合成中"; steps[2].time = "00:18"; }
      if (pct >= 65) { steps[2].state = "done"; steps[2].time = "00:42"; steps[3].state = "current"; steps[3].sub = "渲染中"; steps[3].time = "00:24"; }
      if (pct >= 100) { steps[3].state = "done"; steps[3].time = "1:12"; clearInterval(pollTimer); pollTimer = null; }

      this.setData({ progress: pct, etaText: formatDuration(etaSec), frame: 8 + Math.min(4, Math.floor(pct / 25)), steps });

      if (pct >= 100) {
        wx.showToast({ icon: "success", title: "生成完成" });
        setTimeout(() => {
          wx.redirectTo({ url: "/pages/video-detail/index?id=mock-just-done" });
        }, 800);
      }
    }, 1200);
  },

  back() { wx.navigateBack(); }
});
