const { CelebrityApi } = require("../../utils/api.js");
const { formatCompactNumber, formatDuration } = require("../../utils/format.js");

const app = getApp();

Page({
  data: {
    statusBarHeight: 44,
    starId: "",
    detail: {
      name: "", profession: "", startingPrice: "", sla: "",
      tags: [], skills: [], cases: [],
      photos: [], videos: [],
      auth: { status: "unauthorized" },
      authProgress: { percent: 0, steps: [] }
    },
    fansText: "—",
    avgGmvText: "0",
    faved: false,
    playerOpen: false,
    playerUrl: "",
    playerTitle: ""
  },

  onLoad(options) {
    // 平台坑：onLoad options 偶尔为空（webview 跳回）。详见 agent.md「生命周期」
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
      // 计算视频时长展示文案
      const videos = (d.videos || []).map((v) => ({ ...v, durationText: formatDuration(v.durationSec) }));
      this.setData({
        detail: { ...d, videos, photos: d.photos || [], skills: d.skills || [], cases: d.cases || [], tags: d.tags || [] },
        fansText: formatCompactNumber(d.fans),
        avgGmvText: (d.avgGmv || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  back() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/market/index" });
  },

  /** 已授权 → 直达生成器，预填明星 */
  goGenerate() {
    app.globalData.selectedStarId = this.data.starId;
    wx.navigateTo({ url: "/pages/generator/index?starId=" + this.data.starId });
  },

  onPendingTap() {
    wx.showToast({ icon: "none", title: "审核中（48h SLA），完成后自动开放生成" });
  },

  apply() {
    wx.showActionSheet({
      itemList: ["上传营业执照", "上传品类经营许可", "查看审核 SLA"],
      success: () => {
        wx.showToast({ icon: "success", title: "已提交申请" });
      }
    });
  },

  onFav() {
    this.setData({ faved: !this.data.faved });
    wx.showToast({ icon: "none", title: this.data.faved ? "已收藏" : "已取消收藏" });
  },

  /** 资料图集 · 单图预览（小程序原生 previewImage） */
  previewPhoto(e) {
    const i = Number(e.currentTarget.dataset.i);
    const photos = this.data.detail.photos || [];
    const urls = photos.map((p) => p.url).filter(Boolean);
    if (urls.length === 0) {
      wx.showToast({ icon: "none", title: "图片源未配置（admin 后台上传）" });
      return;
    }
    wx.previewImage({ current: urls[i] || urls[0], urls });
  },

  /** 形象/代言视频 · 弹层播放 */
  playVideo(e) {
    const url = e.currentTarget.dataset.url;
    const title = e.currentTarget.dataset.title;
    this.setData({ playerOpen: true, playerUrl: url || "", playerTitle: title || "视频" });
  },

  closePlayer() {
    this.setData({ playerOpen: false, playerUrl: "" });
  },

  viewMaterials() {
    wx.showActionSheet({
      itemList: ["营业执照", "品类经营许可", "代言授权书"],
      success: () => wx.showToast({ icon: "none", title: "材料预览开发中（admin 上传）" })
    });
  },

  onFabTap() {
    wx.navigateTo({ url: "/pages/chat/index?botId=ada" });
  }
});
