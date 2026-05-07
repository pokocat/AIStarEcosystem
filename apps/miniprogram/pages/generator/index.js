const { CelebrityApi } = require("../../utils/api.js");

const app = getApp();

Page({
  data: {
    star: { name: "李某某", subtitle: "美食综艺 · 已授权 · 剩余 12 天" },
    product: { name: "每日坚果礼盒装 · 750g", sku: "SKU#A0291 · 原价 ¥199 · 直播价 ¥139" },
    styles: [
      { id: "broadcast", name: "口播种草", desc: "镜头直给 · 信息密度高" },
      { id: "scene", name: "情景剧", desc: "短剧情 · 适合食品/日用" },
      { id: "review", name: "测评开箱", desc: "对比+实物 · 适合数码" },
      { id: "vlog", name: "VLOG", desc: "生活化 · 适合美妆/服饰" }
    ],
    currentStyle: "broadcast",
    durations: [15, 30, 60],
    currentDuration: 30,
    languages: ["普通话", "粤语", "英语"],
    currentLang: "普通话",
    keypoints: ["每日坚果", "原料溯源", "无添加", "送礼场景", "性价比"],
    checkedKeys: [true, true, true, false, false]
  },

  onLoad() {
    const sid = app.globalData.selectedStarId;
    if (sid) this.setData({ "star.subtitle": "已选明星 ID " + sid + " · 已授权" });
  },

  setStyle(e) { this.setData({ currentStyle: e.currentTarget.dataset.id }); },
  setDuration(e) { this.setData({ currentDuration: Number(e.currentTarget.dataset.d) }); },
  setLang(e) { this.setData({ currentLang: e.currentTarget.dataset.l }); },

  toggleKey(e) {
    const i = Number(e.currentTarget.dataset.i);
    // 平台坑：直接 setData 路径 'checkedKeys[i]' 在某些基础库会报错；构造数组替换。详见 agent.md「setData」
    const next = this.data.checkedKeys.slice();
    next[i] = !next[i];
    this.setData({ checkedKeys: next });
  },

  async startGenerate() {
    wx.showLoading({ title: "提交任务…", mask: true });
    try {
      const r = await CelebrityApi.generate({
        starId: app.globalData.selectedStarId || "star-li",
        styleId: this.data.currentStyle,
        durationSec: this.data.currentDuration,
        language: this.data.currentLang,
        keypoints: this.data.keypoints.filter((_, i) => this.data.checkedKeys[i])
      });
      app.globalData.pendingGeneration = r;
      wx.hideLoading();
      wx.navigateTo({ url: "/pages/generating/index?jobId=" + (r.jobId || "") });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ icon: "none", title: "提交失败" });
    }
  }
});
