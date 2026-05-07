const { CelebrityApi, WalletApi } = require("../../utils/api.js");

const app = getApp();

// 时长系数（与 product_spec_ai_celebrity.md 一致）
const DUR_MULTIPLIER = { 15: 0.7, 30: 1.0, 60: 1.5 };

Page({
  data: {
    star: { name: "李某某", subtitle: "美食综艺 · 已授权 · 剩余 12 天" },
    product: { name: "每日坚果礼盒装 · 750g", sku: "SKU#A0291 · 原价 ¥199 · 直播价 ¥139" },

    styles: [],
    currentStyle: "broadcast",

    engines: [],
    currentEngineName: "HiGen",
    currentEngine: { speed: "~3分钟", creditPrice: 120 },

    durations: [15, 30, 60],
    currentDuration: 30,
    languages: ["普通话", "粤语", "英语"],
    currentLang: "普通话",
    keypoints: ["每日坚果", "原料溯源", "无添加", "送礼场景", "性价比"],
    checkedKeys: [true, true, true, false, false],

    credits: { total: 0 },
    computedCost: 120,
    enoughCredits: true,

    previewOpen: false,
    previewUrl: "",
    previewTitle: "",
    pendingTemplateId: ""
  },

  async onLoad(options) {
    const sid = (options && options.starId) || app.globalData.selectedStarId;
    if (sid) this.setData({ "star.subtitle": "已选明星 · 已授权 · ID " + sid });

    try {
      const [styles, engines, credits] = await Promise.all([
        CelebrityApi.listTemplates(),
        CelebrityApi.listEngines(),
        WalletApi.getCredits()
      ]);
      const currentEngine = engines.find((e) => e.name === this.data.currentEngineName) || engines[1] || engines[0];
      this.setData({
        styles,
        engines,
        currentEngineName: currentEngine.name,
        currentEngine,
        credits
      }, () => this.recompute());
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  /** 动态重算积分消耗 + 检查余额是否足够 */
  recompute() {
    const e = this.data.currentEngine || {};
    const mul = DUR_MULTIPLIER[this.data.currentDuration] || 1;
    const cost = Math.round((e.creditPrice || 0) * mul);
    this.setData({
      computedCost: cost,
      enoughCredits: (this.data.credits.total || 0) >= cost
    });
  },

  setStyle(e) {
    this.setData({ currentStyle: e.currentTarget.dataset.id });
  },

  /** 点击模板缩略图 → 弹层预览（不切换选中态，让用户看完决定） */
  previewTemplate(e) {
    const id = e.currentTarget.dataset.id;
    const tpl = this.data.styles.find((s) => s.id === id);
    if (!tpl) return;
    this.setData({
      previewOpen: true,
      previewUrl: tpl.previewVideoUrl || "",
      previewTitle: tpl.name,
      pendingTemplateId: id
    });
  },

  closePreview() {
    this.setData({ previewOpen: false, previewUrl: "" });
  },

  /** 弹层底部"使用此模板"→ 选中并关闭 */
  useThisTemplate() {
    if (this.data.pendingTemplateId) {
      this.setData({ currentStyle: this.data.pendingTemplateId });
    }
    this.closePreview();
  },

  setEngine(e) {
    const name = e.currentTarget.dataset.name;
    const eng = this.data.engines.find((x) => x.name === name);
    if (!eng) return;
    this.setData({ currentEngineName: name, currentEngine: eng }, () => this.recompute());
  },

  setDuration(e) {
    this.setData({ currentDuration: Number(e.currentTarget.dataset.d) }, () => this.recompute());
  },

  setLang(e) { this.setData({ currentLang: e.currentTarget.dataset.l }); },

  toggleKey(e) {
    const i = Number(e.currentTarget.dataset.i);
    // 平台坑：直接 setData 路径 'checkedKeys[i]' 在某些基础库会报错；构造数组替换。详见 agent.md「setData」
    const next = this.data.checkedKeys.slice();
    next[i] = !next[i];
    this.setData({ checkedKeys: next });
  },

  changeStar() {
    wx.switchTab({ url: "/pages/market/index" });
  },

  addProduct() {
    wx.showActionSheet({
      itemList: ["从商品库选择", "扫码添加 SKU", "粘贴链接导入"],
      success: () => wx.showToast({ icon: "none", title: "商品库开发中（admin 录入）" })
    });
  },

  onAiRecommend() {
    // 重置成 AI 推荐的 3 个
    this.setData({ checkedKeys: [true, true, true, false, false] });
    wx.showToast({ icon: "success", title: "已应用 AI 推荐" });
  },

  goHistory() {
    wx.switchTab({ url: "/pages/videos/index" });
  },

  goRecharge() {
    wx.navigateTo({ url: "/pages/recharge/index" });
  },

  async startGenerate() {
    if (!this.data.enoughCredits) {
      wx.showModal({
        title: "积分余额不足",
        content: "本次需要 " + this.data.computedCost + " 积分，当前余额 " + this.data.credits.total + " 积分。是否前往充值？",
        confirmText: "去充值",
        success: (res) => { if (res.confirm) this.goRecharge(); }
      });
      return;
    }
    wx.showLoading({ title: "提交任务…", mask: true });
    try {
      const r = await CelebrityApi.generate({
        starId: app.globalData.selectedStarId || "star-li",
        templateId: this.data.currentStyle,
        engineName: this.data.currentEngineName,
        durationSec: this.data.currentDuration,
        language: this.data.currentLang,
        keypoints: this.data.keypoints.filter((_, i) => this.data.checkedKeys[i]),
        creditCost: this.data.computedCost
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
