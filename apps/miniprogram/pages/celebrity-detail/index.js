const { CelebrityApi } = require("../../utils/api.js");

const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    starId: "",
    detail: {
      name: "", profession: "", startingPrice: "", sla: "",
      tags: [], skills: [], cases: [],
      authProgress: { percent: 0, steps: [] }
    }
  },

  onLoad(options) {
    // 平台坑：onLoad options 偶尔为空对象（webview 跳回）。详见 agent.md「生命周期」
    const id = (options && options.id) || app.globalData.selectedStarId || "star-li";
    app.globalData.selectedStarId = id;
    try {
      const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 });
    } catch (e) {}
    this.setData({ starId: id });
    this.fetch(id);
  },

  async fetch(id) {
    try {
      const d = await CelebrityApi.getStar(id);
      this.setData({ detail: d });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  back() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/market/index" });
  },

  apply() {
    wx.showActionSheet({
      itemList: ["上传营业执照", "上传品类经营许可", "查看审核 SLA"],
      success: () => {
        wx.showToast({ icon: "success", title: "已提交申请" });
      }
    });
  }
});
