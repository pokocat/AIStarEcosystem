const { CelebrityApi } = require("../../utils/api.js");

Page({
  data: {
    statusBarHeight: 44,
    detail: { tags: ["", "", ""], performance: { trend: [], metrics: [] }, channels: [], recipe: [], script: [] },
    pubCount: 0,
    gmvText: "0"
  },

  onLoad(options) {
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
    this.fetch((options && options.id) || "T-2024-1024-07");
  },

  async fetch(id) {
    try {
      const d = await CelebrityApi.getVideo(id);
      const pubCount = (d.channels || []).filter((c) => c.state === "pub").length;
      const gmvText = d.performance && d.performance.gmv
        ? d.performance.gmv.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : "0";
      this.setData({ detail: d, pubCount, gmvText });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  back() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/videos/index" });
  }
});
