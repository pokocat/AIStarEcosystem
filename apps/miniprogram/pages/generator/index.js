const { CelebrityApi, WalletApi } = require("../../utils/api.js");

const app = getApp();

// 时长系数（与 product_spec_ai_celebrity.md 一致）
const DUR_MULTIPLIER = { 15: 0.7, 30: 1.0, 60: 1.5 };

Page({
  data: {
    // 默认空态；onLoad 时从 server / globalData 取真实数据
    star: { name: "—", subtitle: "请先在市场选择已授权明星" },
    product: { name: "", sku: "" },

    styles: [],
    currentStyle: "",

    engines: [],
    currentEngineName: "HiGen",
    currentEngine: { speed: "", creditPrice: 0 },

    // v0.5.1：durations / languages / keypoints 全部从 server dictionaries 拉取
    durations: [],
    currentDuration: 30,
    languages: [],
    currentLang: "",
    keypoints: [],
    checkedKeys: [],

    credits: { totalBalance: 0 },
    computedCost: 0,
    enoughCredits: true,

    previewOpen: false,
    previewUrl: "",
    previewTitle: "",
    pendingTemplateId: ""
  },

  async onLoad(options) {
    const sid = (options && options.starId) || app.globalData.selectedStarId;
    if (sid) {
      // 取真实明星元数据填充 subtitle（不再写死"已授权 · 剩余 12 天"）
      try {
        const star = await CelebrityApi.getStar(sid);
        const auth = star && star.authorization ? star.authorization : null;
        const subtitleParts = [];
        if (star && star.category) subtitleParts.push(star.category);
        if (auth && auth.status) {
          const map = { authorized: "已授权", pending: "审核中", expired: "已过期", unauthorized: "未授权" };
          subtitleParts.push(map[auth.status] || auth.status);
        }
        this.setData({
          "star.name": star ? star.name : "—",
          "star.subtitle": subtitleParts.join(" · ") || ("ID " + sid)
        });
      } catch (e) { /* 忽略：保持空态 */ }
    }

    try {
      const [styles, engines, credits, dict] = await Promise.all([
        CelebrityApi.listTemplates(),
        CelebrityApi.listEngines(),
        WalletApi.getCredits(),
        CelebrityApi.getDictionaries()
      ]);
      const currentEngine = engines.find((e) => e.name === this.data.currentEngineName) || engines[1] || engines[0];
      const currentStyle = (styles && styles.length > 0) ? styles[0].id : "";
      const durations = (dict && dict.durations) || [15, 30, 60];
      const languages = (dict && dict.languages) || ["普通话"];
      const keypoints = (dict && dict.keypointSuggestions) || [];
      this.setData({
        styles,
        currentStyle,
        engines,
        currentEngineName: currentEngine ? currentEngine.name : "HiGen",
        currentEngine: currentEngine || { creditPrice: 0 },
        credits,
        durations,
        currentDuration: durations.indexOf(30) >= 0 ? 30 : durations[0],
        languages,
        currentLang: languages[0] || "",
        keypoints,
        checkedKeys: keypoints.map((_, i) => i < 3) // 默认勾选前 3 个
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
      enoughCredits: (this.data.credits.totalBalance || 0) >= cost
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
    // v0.5.1：根据当前 keypoints 长度构造默认勾选（前 3 个），不再写死 5 长度
    const next = this.data.keypoints.map((_, i) => i < 3);
    this.setData({ checkedKeys: next });
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
        content: "本次需要 " + this.data.computedCost + " 积分，当前余额 " + this.data.credits.totalBalance + " 积分。是否前往充值？",
        confirmText: "去充值",
        success: (res) => { if (res.confirm) this.goRecharge(); }
      });
      return;
    }
    wx.showLoading({ title: "提交任务…", mask: true });
    try {
      const r = await CelebrityApi.generate({
        starId: app.globalData.selectedStarId || "",
        templateId: this.data.currentStyle,
        engineName: this.data.currentEngineName,
        durationSec: this.data.currentDuration,
        language: this.data.currentLang,
        keypoints: this.data.keypoints.filter((_, i) => this.data.checkedKeys[i]),
        creditCost: this.data.computedCost
      });
      app.globalData.pendingGeneration = r;
      wx.hideLoading();
      // v0.5.3：业务关键节点立即触发一次未读拉取（让 tabBar 红点近实时变化）
      if (typeof app.triggerUnreadRefresh === "function") app.triggerUnreadRefresh();
      wx.navigateTo({ url: "/pages/generating/index?jobId=" + (r.jobId || "") });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ icon: "none", title: "提交失败" });
    }
  }
});
