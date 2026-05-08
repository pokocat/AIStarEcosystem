// v0.5.1：从客户端 setInterval 假动画改为轮询 server `GET /celebrity/jobs/{jobId}`。
// 服务端依据 startedAt + totalSec 计算真实进度；mock 模式由 utils/mocks.buildJobProgress 派生。
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
    state: "queued",
    steps: []
  },

  onLoad(options) {
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
    this.setData({ jobId: (options && options.jobId) || "" });
    // 立即拉一次，再开启轮询
    this.tick();
    pollTimer = setInterval(() => this.tick(), 1200);
  },

  onUnload() {
    // 平台坑：必须在 onUnload 清 interval，否则内存泄漏 + 后台 setData 报警。详见 agent.md「网络」
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  },

  /** 单次拉取进度并 setData。 */
  async tick() {
    if (!this.data.jobId) return;
    try {
      const r = await CelebrityApi.getJobProgress(this.data.jobId);
      const pct = Math.max(0, Math.min(100, Number(r.progress || 0)));
      this.setData({
        progress: pct,
        etaText: formatDuration(Number(r.etaSec || 0)),
        frame: 8 + Math.min(4, Math.floor(pct / 25)),
        state: r.state || "running",
        steps: Array.isArray(r.steps) ? r.steps : []
      });
      if (r.state === "done" || pct >= 100) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        wx.showToast({ icon: "success", title: "生成完成" });
        setTimeout(() => {
          wx.redirectTo({ url: "/pages/video-detail/index?id=" + encodeURIComponent(this.data.jobId) });
        }, 800);
      }
    } catch (e) {
      // 拉取失败不弹错（可能是网络抖动）；继续轮询。
    }
  },

  back() { wx.navigateBack(); },

  onBackground() {
    wx.showToast({ icon: "none", title: "已转后台 · 完成后片片会发消息" });
    setTimeout(() => wx.switchTab({ url: "/pages/videos/index" }), 600);
  }
});
