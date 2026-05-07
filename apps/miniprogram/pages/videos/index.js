const { CelebrityApi } = require("../../utils/api.js");
const { formatCompactNumber, formatCurrency, formatDuration } = require("../../utils/format.js");

Page({
  data: {
    empty: false,
    wallet: { total: 50, used: 0, generating: 0, remaining: 50, resetAt: "11/01" },
    usedPct: 0,
    pendingPct: 0,
    generating: [],
    filters: [
      { id: "all", label: "全部", count: 0 },
      { id: "gen", label: "生成中", count: 0 },
      { id: "draft", label: "草稿", count: 0 },
      { id: "pub", label: "已发布", count: 0 },
      { id: "fail", label: "失败", count: 0 }
    ],
    currentFilter: "all",
    videos: [],
    stateText: { draft: "草稿", pub: "已发布", fail: "失败" },
    emptySteps: [
      { n: 1, title: "选择已授权明星", state: "done" },
      { n: 2, title: "挑选商品 + 风格", state: "current" },
      { n: 3, title: "AI 60 秒生成", state: "todo" }
    ]
  },

  onLoad() { this.fetch(); },

  onShow() {
    if (this.getTabBar) {
      const t = this.getTabBar();
      if (t) t.setData({ selected: 1 });
    }
    // 平台坑：onShow 频繁触发，做去重。详见 agent.md「生命周期」
    if (this._refreshing) return;
    this._refreshing = true;
    this.fetch().finally(() => { this._refreshing = false; });
  },

  async fetch() {
    try {
      const r = await CelebrityApi.listVideos({ state: this.data.currentFilter });
      const wallet = r.wallet;
      const usedPct = Math.round((wallet.used / wallet.total) * 100);
      const pendingPct = Math.round((wallet.generating / wallet.total) * 100);

      const generating = (r.generating || []).map((g) => ({ ...g, etaText: formatDuration(g.etaSec) }));
      const items = (r.items || []).map((v) => ({
        ...v,
        durationText: v.duration > 0 ? formatDuration(v.duration) : "—",
        viewsText: formatCompactNumber(v.views),
        gmvText: v.gmv ? v.gmv.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "0"
      }));

      const counts = items.reduce((m, v) => { m[v.state] = (m[v.state] || 0) + 1; return m; }, {});
      const filters = this.data.filters.map((f) => ({
        ...f,
        count: f.id === "all" ? items.length : f.id === "gen" ? generating.length : (counts[f.id] || 0)
      }));

      this.setData({
        empty: items.length === 0 && generating.length === 0,
        wallet, usedPct, pendingPct,
        generating, videos: items, filters
      });
    } catch (e) {
      wx.showToast({ icon: "none", title: "加载失败" });
    }
  },

  setFilter(e) {
    this.setData({ currentFilter: e.currentTarget.dataset.id }, () => this.fetch());
  },

  goNew() { wx.navigateTo({ url: "/pages/generator/index" }); },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/video-detail/index?id=" + id });
  },

  goRecharge() { wx.navigateTo({ url: "/pages/recharge/index" }); },

  onPublishDraft(e) {
    const id = e.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ["发布到抖音", "发布到视频号", "发布到快手", "发布到小红书", "全部 4 个平台"],
      success: () => wx.showToast({ icon: "success", title: "已提交（mock）" })
    });
  },

  onRetry(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "重新生成？",
      content: "本次任务失败，重试将再次扣减积分（失败的视频会自动退回积分）。",
      confirmText: "去配置",
      success: (res) => { if (res.confirm) wx.navigateTo({ url: "/pages/generator/index" }); }
    });
  },

  onFabTap() { wx.navigateTo({ url: "/pages/chat/index?botId=pian" }); }
});
