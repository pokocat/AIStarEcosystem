const { CelebrityApi } = require("../../utils/api.js");

Page({
  data: {
    statusBarHeight: 44,
    detail: { tags: ["", "", ""], performance: { trend: [], metrics: [] }, channels: [], recipe: [], script: [] },
    pubCount: 0,
    gmvText: "0",
    faved: false
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
  },

  onPlay() {
    wx.showToast({ icon: "none", title: "视频播放器开发中（接 video 标签）" });
  },

  onDownload() {
    wx.showToast({ icon: "none", title: "下载到本地开发中" });
  },

  onMore() {
    wx.showActionSheet({
      itemList: ["分享给微信好友", "复制视频链接", "归档", "删除"],
      success: () => wx.showToast({ icon: "none", title: "开发中" })
    });
  },

  onDistribute() {
    wx.showActionSheet({
      itemList: ["发布到抖音", "发布到视频号", "发布到快手", "发布到小红书", "全部 4 个平台"],
      success: () => {
        wx.showLoading({ title: "提交分发中…", mask: true });
        setTimeout(() => {
          wx.hideLoading();
          wx.showToast({ icon: "success", title: "已提交" });
        }, 600);
      }
    });
  },

  onCopyAndEdit() {
    wx.navigateTo({ url: "/pages/generator/index?from=" + this.data.detail.id });
  },

  onFav() {
    this.setData({ faved: !this.data.faved });
    wx.showToast({ icon: "none", title: this.data.faved ? "已收藏" : "已取消收藏" });
  },

  onFullScript() {
    wx.showToast({ icon: "none", title: "完整脚本开发中" });
  },

  onChannelTap(e) {
    const name = e.currentTarget.dataset.name;
    const state = e.currentTarget.dataset.state;
    if (state === "todo") {
      wx.showModal({
        title: "发布到 " + name + "？",
        content: "确认后将自动同步至 " + name + "（需先在 admin 后台绑定账号）。",
        confirmText: "去发布",
        success: (res) => { if (res.confirm) this.onDistribute(); }
      });
    } else {
      wx.showToast({ icon: "none", title: name + " 数据明细开发中" });
    }
  },

  onCoachTap() {
    wx.navigateTo({ url: "/pages/chat/index?botId=zhang" });
  }
});
