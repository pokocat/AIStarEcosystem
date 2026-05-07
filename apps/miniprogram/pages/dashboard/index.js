const { DashboardApi } = require("../../utils/api.js");

Page({
  data: {
    ranges: ["今日", "7日", "30日", "自定义"],
    currentRange: "7日",
    data: { bars: [], kpis: [], funnel: [], topVideos: [], coachReview: "" },
    barHeights: [],
    highlightBar: 11,
    gmvText: "0",
    chgText: "0%"
  },

  onLoad() { this.fetch(); },

  async fetch() {
    try {
      const d = await DashboardApi.get();
      // 平台坑：尽量在 JS 里把渲染需要的派生值算好；避免 WXML 复杂表达式（基础库 2.x 表达式偶有解析 bug）。
      const max = Math.max.apply(null, d.bars);
      const barHeights = d.bars.map((v) => Math.round((v / max) * 152));
      const gmvText = d.gmv7d.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const chgText = (d.gmvChange * 100).toFixed(1) + "%";

      const top = d.topVideos.map((t) => ({ ...t, gmvText: t.gmv.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") }));

      this.setData({
        data: { ...d, topVideos: top },
        barHeights,
        gmvText,
        chgText,
        highlightBar: barHeights.length - 2,
        currentRange: d.range || this.data.currentRange
      });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  setRange(e) {
    this.setData({ currentRange: e.currentTarget.dataset.r });
    // 真实联调时按 range 调 GET /celebrity/overview?range=...
  }
});
